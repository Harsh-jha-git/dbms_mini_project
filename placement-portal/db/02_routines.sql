-- Functions, triggers, stored procedures and views.
-- Run with the mysql command-line client (it understands DELIMITER).
USE internship_recruitment_db;

DROP FUNCTION IF EXISTS fn_student_tier_lock;
DROP TRIGGER IF EXISTS trg_application_bi;
DROP TRIGGER IF EXISTS trg_application_ai;
DROP TRIGGER IF EXISTS trg_application_bu;
DROP TRIGGER IF EXISTS trg_application_au;
DROP PROCEDURE IF EXISTS sp_apply;
DROP PROCEDURE IF EXISTS sp_set_application_status;
DROP PROCEDURE IF EXISTS sp_respond_offer;
DROP VIEW IF EXISTS v_opportunity_overview;
DROP VIEW IF EXISTS v_student_branch_rank;
DROP VIEW IF EXISTS v_branch_placement;

DELIMITER $$

-- Highest tier_rank among the student's ACCEPTED full-time offers (0 = no lock yet).
-- The student may only apply to Full-time opportunities with tier_rank > this value.
CREATE FUNCTION fn_student_tier_lock(p_student INT) RETURNS TINYINT
READS SQL DATA
BEGIN
    DECLARE v_lock TINYINT;
    SELECT COALESCE(MAX(o.tier_rank), 0) INTO v_lock
    FROM offer f
    JOIN application a ON a.application_id = f.application_id
    JOIN opportunity o ON o.opportunity_id = a.opportunity_id
    WHERE a.student_id = p_student
      AND f.status = 'Accepted'
      AND o.`type` = 'Full-time';
    RETURN v_lock;
END$$

-- Safety net: the tier rule is enforced by the database itself, not just the UI.
CREATE TRIGGER trg_application_bi BEFORE INSERT ON application
FOR EACH ROW
BEGIN
    DECLARE v_type VARCHAR(30);
    DECLARE v_rank TINYINT;
    SELECT `type`, tier_rank INTO v_type, v_rank
    FROM opportunity WHERE opportunity_id = NEW.opportunity_id;
    IF v_type = 'Full-time' AND v_rank <= fn_student_tier_lock(NEW.student_id) THEN
        SIGNAL SQLSTATE '45000'
            SET MESSAGE_TEXT = 'Tier lock: you can only apply to a higher tier than your accepted offer';
    END IF;
END$$

CREATE TRIGGER trg_application_ai AFTER INSERT ON application
FOR EACH ROW
BEGIN
    INSERT INTO application_status_history (application_id, old_status, new_status)
    VALUES (NEW.application_id, NULL, NEW.status);
END$$

CREATE TRIGGER trg_application_bu BEFORE UPDATE ON application
FOR EACH ROW
BEGIN
    DECLARE v_openings SMALLINT;
    DECLARE v_filled SMALLINT;
    IF NEW.status <> OLD.status THEN
        IF OLD.status IN ('Rejected', 'Withdrawn') THEN
            SIGNAL SQLSTATE '45000'
                SET MESSAGE_TEXT = 'This application is already closed (Rejected or Withdrawn)';
        END IF;
        IF NEW.status = 'Selected' THEN
            SELECT openings, filled INTO v_openings, v_filled
            FROM opportunity WHERE opportunity_id = NEW.opportunity_id;
            IF v_filled >= v_openings THEN
                SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'No openings left for this opportunity';
            END IF;
        END IF;
    END IF;
END$$

-- Logs every status change. When a candidate becomes Selected, the offer is created
-- automatically and the slot is reserved (filled + 1; closes the opportunity if full).
CREATE TRIGGER trg_application_au AFTER UPDATE ON application
FOR EACH ROW
BEGIN
    IF NEW.status <> OLD.status THEN
        INSERT INTO application_status_history (application_id, old_status, new_status)
        VALUES (NEW.application_id, OLD.status, NEW.status);

        IF NEW.status = 'Selected' THEN
            INSERT INTO offer (application_id, offer_type, salary_stipend, offer_date, joining_date, status)
            SELECT NEW.application_id, o.`type`, o.stipend_or_ctc, CURDATE(),
                   GREATEST(COALESCE(o.start_date, DATE_ADD(CURDATE(), INTERVAL 30 DAY)), CURDATE()),
                   'Offered'
            FROM opportunity o WHERE o.opportunity_id = NEW.opportunity_id;

            UPDATE opportunity
               SET status = IF(filled + 1 >= openings, 'Closed', status),
                   filled = filled + 1
             WHERE opportunity_id = NEW.opportunity_id;
        END IF;
    END IF;
END$$

-- Student applies. Checks approval, deadline, branch and eligibility; the unique key and
-- the tier-lock trigger do the rest.
CREATE PROCEDURE sp_apply(IN p_student INT, IN p_opp INT)
BEGIN
    DECLARE v_status VARCHAR(30);
    DECLARE v_approval VARCHAR(20);
    DECLARE v_deadline DATE;
    DECLARE v_branch_ok INT DEFAULT 0;
    DECLARE v_eligible INT DEFAULT 0;
    DECLARE EXIT HANDLER FOR 1062
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You have already applied to this opportunity';

    SELECT status, approval_status, application_deadline
      INTO v_status, v_approval, v_deadline
      FROM opportunity WHERE opportunity_id = p_opp;

    IF v_status IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Opportunity not found';
    END IF;
    IF v_approval <> 'Approved' OR v_status <> 'Open' OR v_deadline < CURDATE() THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This opportunity is not open for applications';
    END IF;

    SELECT COUNT(*) INTO v_branch_ok
      FROM student s
      JOIN opportunity_branch ob ON ob.branch_id = s.branch_id AND ob.opportunity_id = p_opp
     WHERE s.student_id = p_student;
    IF v_branch_ok = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Your branch is not eligible for this opportunity';
    END IF;

    SELECT COUNT(*) INTO v_eligible
      FROM student s
      LEFT JOIN student_scores sc ON sc.student_id = s.student_id
      LEFT JOIN eligibility_criteria e ON e.opportunity_id = p_opp
     WHERE s.student_id = p_student
       AND (e.min_cgpa IS NULL OR s.cgpa >= e.min_cgpa)
       AND (e.max_backlogs IS NULL OR s.backlogs <= e.max_backlogs)
       AND (e.min_attendance IS NULL OR s.attendance_percentage >= e.min_attendance)
       AND (e.min_aptitude_score IS NULL OR sc.aptitude_score >= e.min_aptitude_score)
       AND (e.min_communication_score IS NULL OR sc.communication_skill_score >= e.min_communication_score);
    IF v_eligible = 0 THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'You do not meet the eligibility criteria';
    END IF;

    INSERT INTO application (student_id, opportunity_id, status) VALUES (p_student, p_opp, 'Applied');
END$$

-- Recruiter changes an application's status. The opportunity row is locked first, so two
-- recruiters (or two clicks) cannot both take the last slot. The triggers above do the rest.
CREATE PROCEDURE sp_set_application_status(IN p_app INT, IN p_new VARCHAR(30))
BEGIN
    DECLARE v_opp INT;
    DECLARE v_dummy SMALLINT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    SELECT opportunity_id INTO v_opp FROM application WHERE application_id = p_app;
    IF v_opp IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Application not found';
    END IF;
    SELECT filled INTO v_dummy FROM opportunity WHERE opportunity_id = v_opp FOR UPDATE;
    UPDATE application SET status = p_new WHERE application_id = p_app;
    COMMIT;
END$$

-- Student accepts or declines an offer.
-- Accept (Full-time): withdraw their other pending applications at the same or lower tier,
-- decline their other offers at the same or lower tier (freeing those slots).
-- Internships never trigger the tier rule.
CREATE PROCEDURE sp_respond_offer(IN p_offer INT, IN p_accept TINYINT)
BEGIN
    DECLARE v_app INT;
    DECLARE v_student INT;
    DECLARE v_opp INT;
    DECLARE v_type VARCHAR(30);
    DECLARE v_rank TINYINT;
    DECLARE v_status VARCHAR(30);
    DECLARE v_dummy SMALLINT;
    DECLARE EXIT HANDLER FOR SQLEXCEPTION
    BEGIN
        ROLLBACK;
        RESIGNAL;
    END;

    START TRANSACTION;
    SELECT f.application_id, f.status, a.student_id, a.opportunity_id, o.`type`, o.tier_rank
      INTO v_app, v_status, v_student, v_opp, v_type, v_rank
      FROM offer f
      JOIN application a ON a.application_id = f.application_id
      JOIN opportunity o ON o.opportunity_id = a.opportunity_id
     WHERE f.offer_id = p_offer
       FOR UPDATE;

    IF v_app IS NULL THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'Offer not found';
    END IF;
    IF v_status <> 'Offered' THEN
        SIGNAL SQLSTATE '45000' SET MESSAGE_TEXT = 'This offer has already been answered';
    END IF;

    IF p_accept = 1 THEN
        UPDATE offer SET status = 'Accepted' WHERE offer_id = p_offer;

        IF v_type = 'Full-time' THEN
            -- 1. withdraw other pending applications at same or lower tier
            UPDATE application a
              JOIN opportunity o ON o.opportunity_id = a.opportunity_id
               SET a.status = 'Withdrawn'
             WHERE a.student_id = v_student
               AND a.application_id <> v_app
               AND o.`type` = 'Full-time' AND o.tier_rank <= v_rank
               AND a.status IN ('Applied', 'Shortlisted', 'Interview');

            -- 2. free the slots held by other pending offers at same or lower tier
            UPDATE opportunity o
              JOIN application a ON a.opportunity_id = o.opportunity_id
              JOIN offer f ON f.application_id = a.application_id
               SET o.filled = o.filled - 1,
                   o.status = IF(o.application_deadline >= CURDATE(), 'Open', o.status)
             WHERE a.student_id = v_student AND f.offer_id <> p_offer
               AND f.status = 'Offered'
               AND o.`type` = 'Full-time' AND o.tier_rank <= v_rank;

            -- 3. decline those offers and withdraw their applications
            UPDATE offer f
              JOIN application a ON a.application_id = f.application_id
              JOIN opportunity o ON o.opportunity_id = a.opportunity_id
               SET f.status = 'Declined', a.status = 'Withdrawn'
             WHERE a.student_id = v_student AND f.offer_id <> p_offer
               AND f.status = 'Offered'
               AND o.`type` = 'Full-time' AND o.tier_rank <= v_rank;
        END IF;
    ELSE
        SELECT filled INTO v_dummy FROM opportunity WHERE opportunity_id = v_opp FOR UPDATE;
        UPDATE offer SET status = 'Declined' WHERE offer_id = p_offer;
        UPDATE application SET status = 'Withdrawn' WHERE application_id = v_app;
        UPDATE opportunity
           SET filled = filled - 1,
               status = IF(application_deadline >= CURDATE(), 'Open', status)
         WHERE opportunity_id = v_opp;
    END IF;
    COMMIT;
END$$

DELIMITER ;

-- ---------- Views ----------
CREATE VIEW v_opportunity_overview AS
SELECT o.opportunity_id, o.title, o.`type`, o.tier, o.tier_rank, o.stipend_or_ctc,
       o.location, o.`mode`, o.application_deadline, o.status, o.approval_status,
       o.openings, o.filled, o.openings - o.filled AS slots_left,
       c.company_id, c.company_name, c.industry, o.recruiter_id,
       COUNT(a.application_id) AS applicants
FROM opportunity o
JOIN company c ON c.company_id = o.company_id
LEFT JOIN application a ON a.opportunity_id = o.opportunity_id
GROUP BY o.opportunity_id, c.company_id;

-- Window function: rank students inside their branch by the average of the five assessment scores
CREATE VIEW v_student_branch_rank AS
SELECT s.student_id, s.name, b.branch_name, s.cgpa,
       ROUND((sc.coding_skill_score + sc.aptitude_score + sc.logical_reasoning_score
              + sc.communication_skill_score + sc.mock_interview_score) / 5, 2) AS avg_score,
       RANK() OVER (PARTITION BY s.branch_id
                    ORDER BY (sc.coding_skill_score + sc.aptitude_score + sc.logical_reasoning_score
                              + sc.communication_skill_score + sc.mock_interview_score) DESC) AS branch_rank
FROM student s
JOIN branch b ON b.branch_id = s.branch_id
JOIN student_scores sc ON sc.student_id = s.student_id;

CREATE VIEW v_branch_placement AS
SELECT b.branch_id, b.branch_name,
       COUNT(DISTINCT s.student_id) AS students,
       COUNT(DISTINCT CASE WHEN f.status = 'Accepted' AND f.offer_type = 'Full-time'
                           THEN s.student_id END) AS placed,
       ROUND(100 * COUNT(DISTINCT CASE WHEN f.status = 'Accepted' AND f.offer_type = 'Full-time'
                                       THEN s.student_id END)
             / COUNT(DISTINCT s.student_id), 1) AS placement_pct
FROM branch b
JOIN student s ON s.branch_id = b.branch_id
LEFT JOIN application a ON a.student_id = s.student_id
LEFT JOIN offer f ON f.application_id = a.application_id
GROUP BY b.branch_id, b.branch_name;

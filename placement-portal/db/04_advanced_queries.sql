-- Database: internship_recruitment_db (MySQL 8.0+)
-- File: 04_advanced_queries.sql
-- Description: Advanced SQL scripts and queries including DDL with indexes,
--              CTEs (recursive and non-recursive), correlated subqueries,
--              NOT EXISTS, aggregation with HAVING, and transactions with SAVEPOINT.

USE internship_recruitment_db;

-- ============================================================================
-- 1. Schema Modifications & Full-Text Search
-- ALTER TABLE opportunity ADD COLUMN description TEXT;
-- Two CREATE INDEX statements:
--   - application(status)
--   - opportunity(application_deadline, status)
-- FULLTEXT index on opportunity(title, description) plus MATCH...AGAINST query.
-- ============================================================================

ALTER TABLE opportunity ADD COLUMN description TEXT;

CREATE INDEX idx_application_status 
ON application (status);

CREATE INDEX idx_opportunity_deadline_status 
ON opportunity (application_deadline, status);

CREATE FULLTEXT INDEX idx_opportunity_title_description 
ON opportunity (title, description);

-- Query using the FULLTEXT index across title and description
SELECT 
    opportunity_id,
    title,
    `type`,
    location,
    ROUND(MATCH(title, description) AGAINST('Software Engineer' IN NATURAL LANGUAGE MODE), 4) AS relevance_score
FROM opportunity
WHERE MATCH(title, description) AGAINST('Software Engineer' IN NATURAL LANGUAGE MODE)
ORDER BY relevance_score DESC, opportunity_id;


-- ============================================================================
-- 2. Non-Recursive CTE: Placement Funnel
-- Calculates the count and percentage of applications per status per opportunity type.
-- ============================================================================

WITH status_counts AS (
    SELECT 
        o.`type` AS opportunity_type,
        a.status AS application_status,
        COUNT(*) AS application_count
    FROM application a
    JOIN opportunity o ON a.opportunity_id = o.opportunity_id
    GROUP BY o.`type`, a.status
),
type_totals AS (
    SELECT 
        opportunity_type,
        SUM(application_count) AS total_applications
    FROM status_counts
    GROUP BY opportunity_type
)
SELECT 
    sc.opportunity_type,
    sc.application_status,
    sc.application_count,
    tt.total_applications,
    ROUND((sc.application_count / tt.total_applications) * 100, 2) AS percentage
FROM status_counts sc
JOIN type_totals tt ON sc.opportunity_type = tt.opportunity_type
ORDER BY sc.opportunity_type, sc.application_count DESC;


-- ============================================================================
-- 3. Recursive CTE: Hiring Stages Progression
-- Generates stages: Applied, Shortlisted, Interview, Selected
-- and counts applications that reached each stage using application_status_history.
-- ============================================================================

WITH RECURSIVE hiring_stages (stage_order, stage_name) AS (
    SELECT 1 AS stage_order, CAST('Applied' AS CHAR(30)) AS stage_name
    UNION ALL
    SELECT 
        stage_order + 1,
        CASE stage_order + 1
            WHEN 2 THEN CAST('Shortlisted' AS CHAR(30))
            WHEN 3 THEN CAST('Interview' AS CHAR(30))
            WHEN 4 THEN CAST('Selected' AS CHAR(30))
        END
    FROM hiring_stages
    WHERE stage_order < 4
)
SELECT 
    hs.stage_order,
    hs.stage_name,
    COUNT(DISTINCT ash.application_id) AS applications_reached
FROM hiring_stages hs
LEFT JOIN application_status_history ash ON ash.new_status = hs.stage_name
GROUP BY hs.stage_order, hs.stage_name
ORDER BY hs.stage_order;


-- ============================================================================
-- 4. Correlated Subquery: Students with CGPA Above Their Branch Average
-- ============================================================================

SELECT 
    s.student_id,
    s.name,
    b.branch_name,
    s.cgpa,
    ROUND((SELECT AVG(s2.cgpa) FROM student s2 WHERE s2.branch_id = s.branch_id), 2) AS branch_avg_cgpa
FROM student s
JOIN branch b ON s.branch_id = b.branch_id
WHERE s.cgpa > (
    SELECT AVG(s2.cgpa)
    FROM student s2
    WHERE s2.branch_id = s.branch_id
)
ORDER BY b.branch_name, s.cgpa DESC, s.student_id;


-- ============================================================================
-- 5. NOT EXISTS Query: Open, Approved Opportunities with No Applications
-- ============================================================================

SELECT 
    o.opportunity_id,
    o.title,
    o.`type`,
    o.stipend_or_ctc,
    o.location,
    o.status,
    o.approval_status,
    c.company_name
FROM opportunity o
JOIN company c ON o.company_id = c.company_id
WHERE o.status = 'Open'
  AND o.approval_status = 'Approved'
  AND NOT EXISTS (
      SELECT 1
      FROM application a
      WHERE a.opportunity_id = o.opportunity_id
  )
ORDER BY o.opportunity_id;


-- ============================================================================
-- 6. GROUP BY + HAVING: Companies with 3 or More Accepted Offers
-- Displays company name, number of accepted offers, and average salary/stipend.
-- ============================================================================

SELECT 
    c.company_id,
    c.company_name,
    COUNT(ofr.offer_id) AS accepted_offers_count,
    ROUND(AVG(ofr.salary_stipend), 2) AS average_salary
FROM company c
JOIN opportunity opp ON c.company_id = opp.company_id
JOIN application app ON opp.opportunity_id = app.opportunity_id
JOIN offer ofr ON app.application_id = ofr.application_id
WHERE ofr.status = 'Accepted'
GROUP BY c.company_id, c.company_name
HAVING COUNT(ofr.offer_id) >= 3
ORDER BY accepted_offers_count DESC, average_salary DESC;


-- ============================================================================
-- 7. Transaction with SAVEPOINT and ROLLBACK TO
-- Demonstrates partial rollback within a transaction block.
-- Inserts a valid branch, sets a savepoint, attempts an exploratory insert,
-- rolls back only to the savepoint, and commits the valid insert.
-- ============================================================================

DELETE FROM branch WHERE branch_name IN ('Robotics & Automation', 'Temporary Trial Branch');

START TRANSACTION;

-- Step 1: Insert a new valid branch
INSERT INTO branch (branch_name) 
VALUES ('Robotics & Automation');

-- Step 2: Establish a savepoint
SAVEPOINT sp_after_valid_branch;

-- Step 3: Tentatively insert another branch
INSERT INTO branch (branch_name) 
VALUES ('Temporary Trial Branch');

-- Step 4: Rollback only to the savepoint (reverts 'Temporary Trial Branch', preserving 'Robotics & Automation')
ROLLBACK TO SAVEPOINT sp_after_valid_branch;

-- Step 5: Commit the transaction
COMMIT;

-- Verification: Only 'Robotics & Automation' was persisted
SELECT branch_id, branch_name 
FROM branch 
WHERE branch_name IN ('Robotics & Automation', 'Temporary Trial Branch');

-- Internship & Recruitment Management System  (schema v3)
-- Requires MySQL 8.0.16+ (CHECK constraints are enforced).
-- Changes from v2: + users table, + opportunity.approval_status,
--                  + UNIQUE(opportunity_id) on eligibility_criteria (true 1:1).
-- WARNING: this script drops and recreates the database.

DROP DATABASE IF EXISTS internship_recruitment_db;
CREATE DATABASE internship_recruitment_db CHARACTER SET utf8mb4;
USE internship_recruitment_db;

CREATE TABLE branch (
    branch_id   INT AUTO_INCREMENT PRIMARY KEY,
    branch_name VARCHAR(100) NOT NULL UNIQUE
) ENGINE=InnoDB;

CREATE TABLE student (
    student_id            INT AUTO_INCREMENT PRIMARY KEY,
    name                  VARCHAR(100) NOT NULL,
    email                 VARCHAR(150) NOT NULL UNIQUE,
    age                   SMALLINT,
    gender                VARCHAR(20),
    cgpa                  DECIMAL(4,2) NOT NULL,
    backlogs              SMALLINT NOT NULL DEFAULT 0,
    attendance_percentage DECIMAL(5,2),
    branch_id             INT NOT NULL,
    CONSTRAINT fk_student_branch FOREIGN KEY (branch_id) REFERENCES branch (branch_id),
    CONSTRAINT chk_student_age CHECK (age > 0),
    CONSTRAINT chk_student_gender CHECK (gender IN ('Male', 'Female', 'Other')),
    CONSTRAINT chk_student_cgpa CHECK (cgpa BETWEEN 0 AND 10),
    CONSTRAINT chk_student_backlogs CHECK (backlogs >= 0),
    CONSTRAINT chk_student_attendance CHECK (attendance_percentage BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE TABLE student_scores (
    student_id                INT PRIMARY KEY,
    coding_skill_score        DECIMAL(5,2),
    aptitude_score            DECIMAL(5,2),
    logical_reasoning_score   DECIMAL(5,2),
    communication_skill_score DECIMAL(5,2),
    mock_interview_score      DECIMAL(5,2),
    certifications_count      SMALLINT NOT NULL DEFAULT 0,
    projects_count            SMALLINT NOT NULL DEFAULT 0,
    github_repos              SMALLINT NOT NULL DEFAULT 0,
    internships_count         SMALLINT NOT NULL DEFAULT 0,
    CONSTRAINT fk_scores_student FOREIGN KEY (student_id) REFERENCES student (student_id),
    CONSTRAINT chk_scores_coding CHECK (coding_skill_score BETWEEN 0 AND 100),
    CONSTRAINT chk_scores_aptitude CHECK (aptitude_score BETWEEN 0 AND 100),
    CONSTRAINT chk_scores_logical CHECK (logical_reasoning_score BETWEEN 0 AND 100),
    CONSTRAINT chk_scores_communication CHECK (communication_skill_score BETWEEN 0 AND 100),
    CONSTRAINT chk_scores_mock CHECK (mock_interview_score BETWEEN 0 AND 100),
    CONSTRAINT chk_scores_certifications CHECK (certifications_count >= 0),
    CONSTRAINT chk_scores_projects CHECK (projects_count >= 0),
    CONSTRAINT chk_scores_github CHECK (github_repos >= 0),
    CONSTRAINT chk_scores_internships CHECK (internships_count >= 0)
) ENGINE=InnoDB;

CREATE TABLE company (
    company_id   INT AUTO_INCREMENT PRIMARY KEY,
    company_name VARCHAR(150) NOT NULL UNIQUE,
    industry     VARCHAR(100),
    website      VARCHAR(255),
    location     VARCHAR(150)
) ENGINE=InnoDB;

CREATE TABLE recruiter (
    recruiter_id INT AUTO_INCREMENT PRIMARY KEY,
    company_id   INT NOT NULL,
    name         VARCHAR(100) NOT NULL,
    email        VARCHAR(150) NOT NULL UNIQUE,
    designation  VARCHAR(100),
    CONSTRAINT fk_recruiter_company FOREIGN KEY (company_id) REFERENCES company (company_id)
) ENGINE=InnoDB;

-- Demo login table. Passwords are unsalted SHA-256: fine for a demo, never for production.
CREATE TABLE users (
    user_id       INT AUTO_INCREMENT PRIMARY KEY,
    username      VARCHAR(50) NOT NULL UNIQUE,
    password_hash CHAR(64) NOT NULL,
    role          VARCHAR(20) NOT NULL,
    student_id    INT NULL UNIQUE,
    recruiter_id  INT NULL UNIQUE,
    CONSTRAINT fk_users_student FOREIGN KEY (student_id) REFERENCES student (student_id),
    CONSTRAINT fk_users_recruiter FOREIGN KEY (recruiter_id) REFERENCES recruiter (recruiter_id),
    CONSTRAINT chk_users_role CHECK (role IN ('student', 'recruiter', 'officer')),
    CONSTRAINT chk_users_link CHECK (
        (role = 'student'   AND student_id IS NOT NULL AND recruiter_id IS NULL) OR
        (role = 'recruiter' AND recruiter_id IS NOT NULL AND student_id IS NULL) OR
        (role = 'officer'   AND student_id IS NULL AND recruiter_id IS NULL))
) ENGINE=InnoDB;

CREATE TABLE opportunity (
    opportunity_id       INT AUTO_INCREMENT PRIMARY KEY,
    company_id           INT NOT NULL,
    recruiter_id         INT NOT NULL,
    title                VARCHAR(150) NOT NULL,
    `type`               VARCHAR(30) NOT NULL,
    stipend_or_ctc       DECIMAL(12,2),
    location             VARCHAR(150),
    `mode`               VARCHAR(30),
    start_date           DATE,
    application_deadline DATE NOT NULL,
    status               VARCHAR(30) NOT NULL,
    approval_status      VARCHAR(20) NOT NULL DEFAULT 'Pending',
    openings             SMALLINT NOT NULL DEFAULT 1,
    filled               SMALLINT NOT NULL DEFAULT 0,
    -- Tier is computed from CTC (rupees/year) for Full-time only; Internships have no tier.
    tier                 VARCHAR(10) GENERATED ALWAYS AS (
        CASE WHEN `type` = 'Full-time' THEN
            CASE WHEN stipend_or_ctc >= 1200000 THEN 'Dream'
                 WHEN stipend_or_ctc >= 700000  THEN 'Tier 1'
                 WHEN stipend_or_ctc >= 450000  THEN 'Tier 2'
                 ELSE 'Tier 3' END
        END) STORED,
    tier_rank            TINYINT GENERATED ALWAYS AS (
        CASE WHEN `type` = 'Full-time' THEN
            CASE WHEN stipend_or_ctc >= 1200000 THEN 4
                 WHEN stipend_or_ctc >= 700000  THEN 3
                 WHEN stipend_or_ctc >= 450000  THEN 2
                 ELSE 1 END
        END) STORED,
    CONSTRAINT fk_opportunity_company FOREIGN KEY (company_id) REFERENCES company (company_id),
    CONSTRAINT fk_opportunity_recruiter FOREIGN KEY (recruiter_id) REFERENCES recruiter (recruiter_id),
    CONSTRAINT chk_opportunity_type CHECK (`type` IN ('Internship', 'Full-time')),
    CONSTRAINT chk_opportunity_amount CHECK (stipend_or_ctc >= 0),
    CONSTRAINT chk_opportunity_mode CHECK (`mode` IN ('Onsite', 'Remote', 'Hybrid')),
    CONSTRAINT chk_opportunity_status CHECK (status IN ('Open', 'Closed')),
    CONSTRAINT chk_opportunity_approval CHECK (approval_status IN ('Pending', 'Approved', 'Rejected')),
    CONSTRAINT chk_opportunity_openings CHECK (openings >= 1),
    CONSTRAINT chk_opportunity_filled CHECK (filled >= 0 AND filled <= openings)
) ENGINE=InnoDB;

CREATE TABLE opportunity_branch (
    opportunity_id INT NOT NULL,
    branch_id      INT NOT NULL,
    PRIMARY KEY (opportunity_id, branch_id),
    CONSTRAINT fk_ob_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunity (opportunity_id),
    CONSTRAINT fk_ob_branch FOREIGN KEY (branch_id) REFERENCES branch (branch_id)
) ENGINE=InnoDB;

CREATE TABLE eligibility_criteria (
    criteria_id             INT AUTO_INCREMENT PRIMARY KEY,
    opportunity_id          INT NOT NULL,
    min_cgpa                DECIMAL(4,2),
    max_backlogs            SMALLINT,
    min_attendance          DECIMAL(5,2),
    min_aptitude_score      DECIMAL(5,2),
    min_communication_score DECIMAL(5,2),
    CONSTRAINT fk_criteria_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunity (opportunity_id),
    CONSTRAINT uq_criteria_opportunity UNIQUE (opportunity_id),
    CONSTRAINT chk_criteria_cgpa CHECK (min_cgpa BETWEEN 0 AND 10),
    CONSTRAINT chk_criteria_backlogs CHECK (max_backlogs >= 0),
    CONSTRAINT chk_criteria_attendance CHECK (min_attendance BETWEEN 0 AND 100),
    CONSTRAINT chk_criteria_aptitude CHECK (min_aptitude_score BETWEEN 0 AND 100),
    CONSTRAINT chk_criteria_communication CHECK (min_communication_score BETWEEN 0 AND 100)
) ENGINE=InnoDB;

CREATE TABLE application (
    application_id INT AUTO_INCREMENT PRIMARY KEY,
    student_id     INT NOT NULL,
    opportunity_id INT NOT NULL,
    applied_on     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    status         VARCHAR(30) NOT NULL,
    CONSTRAINT fk_application_student FOREIGN KEY (student_id) REFERENCES student (student_id),
    CONSTRAINT fk_application_opportunity FOREIGN KEY (opportunity_id) REFERENCES opportunity (opportunity_id),
    CONSTRAINT uq_application_student_opportunity UNIQUE (student_id, opportunity_id),
    CONSTRAINT chk_application_status CHECK (status IN ('Applied', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'Withdrawn'))
) ENGINE=InnoDB;

CREATE TABLE application_status_history (
    history_id     INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    old_status     VARCHAR(30),
    new_status     VARCHAR(30) NOT NULL,
    changed_at     TIMESTAMP NOT NULL DEFAULT CURRENT_TIMESTAMP,
    CONSTRAINT fk_history_application FOREIGN KEY (application_id) REFERENCES application (application_id),
    CONSTRAINT chk_history_old CHECK (old_status IS NULL OR old_status IN ('Applied', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'Withdrawn')),
    CONSTRAINT chk_history_new CHECK (new_status IN ('Applied', 'Shortlisted', 'Interview', 'Selected', 'Rejected', 'Withdrawn'))
) ENGINE=InnoDB;

CREATE TABLE interview (
    interview_id   INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    interviewer_id INT NOT NULL,
    round_no       SMALLINT NOT NULL,
    round_type     VARCHAR(50),
    scheduled_at   TIMESTAMP NULL,
    status         VARCHAR(30) NOT NULL,
    feedback       TEXT,
    CONSTRAINT fk_interview_application FOREIGN KEY (application_id) REFERENCES application (application_id),
    CONSTRAINT fk_interview_interviewer FOREIGN KEY (interviewer_id) REFERENCES recruiter (recruiter_id),
    CONSTRAINT uq_interview_application_round UNIQUE (application_id, round_no),
    CONSTRAINT chk_interview_round_no CHECK (round_no > 0),
    CONSTRAINT chk_interview_round_type CHECK (round_type IN ('Aptitude', 'Technical', 'HR')),
    CONSTRAINT chk_interview_status CHECK (status IN ('Scheduled', 'Completed', 'Cancelled'))
) ENGINE=InnoDB;

CREATE TABLE offer (
    offer_id       INT AUTO_INCREMENT PRIMARY KEY,
    application_id INT NOT NULL,
    offer_type     VARCHAR(30),
    salary_stipend DECIMAL(12,2),
    offer_date     DATE,
    joining_date   DATE,
    status         VARCHAR(30) NOT NULL,
    CONSTRAINT fk_offer_application FOREIGN KEY (application_id) REFERENCES application (application_id),
    CONSTRAINT uq_offer_application UNIQUE (application_id),
    CONSTRAINT chk_offer_type CHECK (offer_type IN ('Internship', 'Full-time')),
    CONSTRAINT chk_offer_salary CHECK (salary_stipend >= 0),
    CONSTRAINT chk_offer_dates CHECK (joining_date >= offer_date),
    CONSTRAINT chk_offer_status CHECK (status IN ('Offered', 'Accepted', 'Declined', 'Withdrawn'))
) ENGINE=InnoDB;

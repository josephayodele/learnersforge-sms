-- ============================================================
-- LearnersForge SMS — Full Database Schema
-- Run this file first in phpMyAdmin or MySQL CLI
-- Database: learnersforge_sms
-- ============================================================

SET FOREIGN_KEY_CHECKS = 0;
SET SQL_MODE = "NO_AUTO_VALUE_ON_ZERO";
SET time_zone = "+00:00";

-- ────────────────────────────────────────────────────────────
-- SCHOOLS & BRANCHES
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `schools` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `name`         VARCHAR(150) NOT NULL,
  `code`         VARCHAR(20)  NOT NULL UNIQUE,
  `address`      TEXT,
  `phone`        VARCHAR(30),
  `email`        VARCHAR(100),
  `logo_url`     VARCHAR(255),
  `motto`        VARCHAR(255),
  `established`  YEAR,
  `term_system`  ENUM('term','semester') DEFAULT 'term',
  `active`       TINYINT(1) DEFAULT 1,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`   DATETIME NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- ACADEMIC YEARS & TERMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `academic_years` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  INT UNSIGNED NOT NULL,
  `name`       VARCHAR(20) NOT NULL,   -- e.g. 2025/2026
  `start_date` DATE NOT NULL,
  `end_date`   DATE NOT NULL,
  `is_current` TINYINT(1) DEFAULT 0,
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `terms` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `academic_year_id` INT UNSIGNED NOT NULL,
  `name`             VARCHAR(20) NOT NULL,  -- 1st Term, 2nd Term, 3rd Term
  `start_date`       DATE NOT NULL,
  `end_date`         DATE NOT NULL,
  `is_current`       TINYINT(1) DEFAULT 0,
  `created_at`       DATETIME DEFAULT CURRENT_TIMESTAMP,
  `deleted_at`       DATETIME NULL,
  FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- USERS (all roles share this table)
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `users` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`    INT UNSIGNED NOT NULL,
  `first_name`   VARCHAR(80)  NOT NULL,
  `last_name`    VARCHAR(80)  NOT NULL,
  `email`        VARCHAR(150) NOT NULL UNIQUE,
  `phone`        VARCHAR(30),
  `password`     VARCHAR(255) NOT NULL,
  `role`         ENUM('super_admin','school_admin','teacher','student','parent','accountant') NOT NULL,
  `avatar_url`   VARCHAR(255),
  `gender`       ENUM('male','female','other'),
  `date_of_birth` DATE,
  `address`      TEXT,
  `is_active`    TINYINT(1) DEFAULT 1,
  `last_login`   DATETIME NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`   DATETIME NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- CLASSES & SUBJECTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `classes` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`        INT UNSIGNED NOT NULL,
  `academic_year_id` INT UNSIGNED NOT NULL,
  `name`             VARCHAR(20) NOT NULL,   -- JSS 1A
  `level`            VARCHAR(10),            -- JSS / SSS
  `form`             VARCHAR(5),             -- 1,2,3
  `arm`              VARCHAR(5),             -- A,B,C
  `form_teacher_id`  INT UNSIGNED NULL,
  `capacity`         TINYINT UNSIGNED DEFAULT 40,
  `created_at`       DATETIME DEFAULT CURRENT_TIMESTAMP,
  `deleted_at`       DATETIME NULL,
  FOREIGN KEY (`school_id`)        REFERENCES `schools`(`id`),
  FOREIGN KEY (`academic_year_id`) REFERENCES `academic_years`(`id`),
  FOREIGN KEY (`form_teacher_id`)  REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `subjects` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  INT UNSIGNED NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `code`       VARCHAR(20),
  `department` VARCHAR(80),
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  `deleted_at` DATETIME NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `class_subjects` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `class_id`   INT UNSIGNED NOT NULL,
  `subject_id` INT UNSIGNED NOT NULL,
  `teacher_id` INT UNSIGNED NULL,
  FOREIGN KEY (`class_id`)   REFERENCES `classes`(`id`),
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`),
  FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  UNIQUE KEY `uq_class_subject` (`class_id`,`subject_id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- STUDENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `students` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`         INT UNSIGNED NOT NULL UNIQUE,
  `student_id`      VARCHAR(20)  NOT NULL UNIQUE,
  `class_id`        INT UNSIGNED NOT NULL,
  `admission_number` VARCHAR(30) UNIQUE,
  `admission_date`  DATE,
  `blood_group`     VARCHAR(5),
  `genotype`        VARCHAR(5),
  `medical_notes`   TEXT,
  `guardian_name`   VARCHAR(150),
  `guardian_phone`  VARCHAR(30),
  `guardian_email`  VARCHAR(150),
  `guardian_address` TEXT,
  `previous_school` VARCHAR(150),
  `created_at`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`      DATETIME NULL,
  FOREIGN KEY (`user_id`)   REFERENCES `users`(`id`),
  FOREIGN KEY (`class_id`)  REFERENCES `classes`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- STAFF
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `staff` (
  `id`              INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`         INT UNSIGNED NOT NULL UNIQUE,
  `staff_id`        VARCHAR(20)  NOT NULL UNIQUE,
  `department`      VARCHAR(80),
  `designation`     VARCHAR(80),
  `qualification`   VARCHAR(150),
  `hire_date`       DATE,
  `salary_grade`    VARCHAR(20),
  `bank_name`       VARCHAR(100),
  `account_number`  VARCHAR(30),
  `created_at`      DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`      DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`      DATETIME NULL,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- TIMETABLE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `timetable_slots` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `class_id`   INT UNSIGNED NOT NULL,
  `subject_id` INT UNSIGNED NOT NULL,
  `teacher_id` INT UNSIGNED NULL,
  `day`        ENUM('Monday','Tuesday','Wednesday','Thursday','Friday') NOT NULL,
  `period`     TINYINT UNSIGNED NOT NULL,
  `start_time` TIME NOT NULL,
  `end_time`   TIME NOT NULL,
  `term_id`    INT UNSIGNED NOT NULL,
  FOREIGN KEY (`class_id`)   REFERENCES `classes`(`id`),
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`),
  FOREIGN KEY (`teacher_id`) REFERENCES `users`(`id`) ON DELETE SET NULL,
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- ATTENDANCE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `attendance` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT UNSIGNED NOT NULL,
  `class_id`   INT UNSIGNED NOT NULL,
  `term_id`    INT UNSIGNED NOT NULL,
  `date`       DATE NOT NULL,
  `status`     ENUM('present','absent-excused','absent-unexcused','late','late-excused','early-dismissal') NOT NULL,
  `dismiss_time` TIME NULL,
  `comment`    VARCHAR(255),
  `marked_by`  INT UNSIGNED NULL,
  `method`     ENUM('manual','qr','biometric') DEFAULT 'manual',
  `created_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_student_date` (`student_id`,`date`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`),
  FOREIGN KEY (`class_id`)   REFERENCES `classes`(`id`),
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`),
  FOREIGN KEY (`marked_by`)  REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- GRADES & ASSESSMENTS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `ca_types` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  INT UNSIGNED NOT NULL,
  `label`      VARCHAR(50) NOT NULL,
  `max_score`  TINYINT UNSIGNED NOT NULL DEFAULT 10,
  `is_enabled` TINYINT(1) DEFAULT 1,
  `sort_order` TINYINT UNSIGNED DEFAULT 0,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `grades` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`   INT UNSIGNED NOT NULL,
  `subject_id`   INT UNSIGNED NOT NULL,
  `term_id`      INT UNSIGNED NOT NULL,
  `ca_type_id`   INT UNSIGNED NOT NULL,
  `score`        DECIMAL(5,2) DEFAULT 0,
  `entered_by`   INT UNSIGNED NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_grade` (`student_id`,`subject_id`,`term_id`,`ca_type_id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`),
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`),
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`),
  FOREIGN KEY (`ca_type_id`) REFERENCES `ca_types`(`id`),
  FOREIGN KEY (`entered_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `teacher_comments` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`   INT UNSIGNED NOT NULL,
  `term_id`      INT UNSIGNED NOT NULL,
  `teacher_comment`   TEXT,
  `principal_comment` TEXT,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_comment` (`student_id`,`term_id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`),
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `psychomotor` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id` INT UNSIGNED NOT NULL,
  `term_id`    INT UNSIGNED NOT NULL,
  `trait`      VARCHAR(80) NOT NULL,
  `rating`     ENUM('Excellent','Very Good','Good','Fair','Poor') NULL,
  `domain`     ENUM('psychomotor','affective') DEFAULT 'psychomotor',
  UNIQUE KEY `uq_psycho` (`student_id`,`term_id`,`trait`,`domain`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`),
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- FEES & FINANCE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `fee_structures` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   INT UNSIGNED NOT NULL,
  `term_id`     INT UNSIGNED NOT NULL,
  `class_id`    INT UNSIGNED NULL,
  `name`        VARCHAR(100) NOT NULL,
  `amount`      DECIMAL(12,2) NOT NULL,
  `fee_type`    ENUM('tuition','hostel','transport','exam','uniform','other') DEFAULT 'tuition',
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`),
  FOREIGN KEY (`term_id`)   REFERENCES `terms`(`id`),
  FOREIGN KEY (`class_id`)  REFERENCES `classes`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `invoices` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `invoice_no`   VARCHAR(30) NOT NULL UNIQUE,
  `student_id`   INT UNSIGNED NOT NULL,
  `term_id`      INT UNSIGNED NOT NULL,
  `total_amount` DECIMAL(12,2) NOT NULL,
  `amount_paid`  DECIMAL(12,2) DEFAULT 0,
  `balance`      DECIMAL(12,2) GENERATED ALWAYS AS (`total_amount` - `amount_paid`) STORED,
  `status`       ENUM('unpaid','partial','paid') DEFAULT 'unpaid',
  `due_date`     DATE,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`),
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `payments` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `invoice_id`     INT UNSIGNED NOT NULL,
  `amount`         DECIMAL(12,2) NOT NULL,
  `method`         ENUM('cash','bank_transfer','online','pos') DEFAULT 'cash',
  `reference`      VARCHAR(100),
  `received_by`    INT UNSIGNED NULL,
  `payment_date`   DATE NOT NULL,
  `notes`          TEXT,
  `created_at`     DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`invoice_id`)   REFERENCES `invoices`(`id`),
  FOREIGN KEY (`received_by`)  REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `expenses` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`    INT UNSIGNED NOT NULL,
  `description`  VARCHAR(255) NOT NULL,
  `category`     ENUM('salaries','utilities','maintenance','supplies','events','transport','medical','other') NOT NULL,
  `amount`       DECIMAL(12,2) NOT NULL,
  `expense_date` DATE NOT NULL,
  `recorded_by`  INT UNSIGNED NULL,
  `status`       ENUM('pending','paid') DEFAULT 'paid',
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)    REFERENCES `schools`(`id`),
  FOREIGN KEY (`recorded_by`)  REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `payroll` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `staff_id`     INT UNSIGNED NOT NULL,
  `month`        TINYINT UNSIGNED NOT NULL,
  `year`         SMALLINT UNSIGNED NOT NULL,
  `basic`        DECIMAL(10,2) NOT NULL,
  `housing`      DECIMAL(10,2) DEFAULT 0,
  `transport`    DECIMAL(10,2) DEFAULT 0,
  `deductions`   DECIMAL(10,2) DEFAULT 0,
  `net_pay`      DECIMAL(10,2) GENERATED ALWAYS AS (`basic`+`housing`+`transport`-`deductions`) STORED,
  `status`       ENUM('pending','paid') DEFAULT 'pending',
  `paid_date`    DATE NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_payroll` (`staff_id`,`month`,`year`),
  FOREIGN KEY (`staff_id`) REFERENCES `staff`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- HOSTEL
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `hostels` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   INT UNSIGNED NOT NULL,
  `name`        VARCHAR(80) NOT NULL,
  `gender`      ENUM('male','female','mixed') NOT NULL,
  `capacity`    SMALLINT UNSIGNED NOT NULL,
  `matron_id`   INT UNSIGNED NULL,
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`),
  FOREIGN KEY (`matron_id`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hostel_rooms` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `hostel_id`  INT UNSIGNED NOT NULL,
  `room_no`    VARCHAR(10) NOT NULL,
  `capacity`   TINYINT UNSIGNED DEFAULT 4,
  UNIQUE KEY `uq_room` (`hostel_id`,`room_no`),
  FOREIGN KEY (`hostel_id`) REFERENCES `hostels`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hostel_allocations` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `room_id`    INT UNSIGNED NOT NULL,
  `student_id` INT UNSIGNED NOT NULL,
  `term_id`    INT UNSIGNED NOT NULL,
  `allocated_at` DATETIME DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_alloc` (`student_id`,`term_id`),
  FOREIGN KEY (`room_id`)    REFERENCES `hostel_rooms`(`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`),
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `hostel_visitors` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`  INT UNSIGNED NOT NULL,
  `visitor_name` VARCHAR(150) NOT NULL,
  `relation`    VARCHAR(50),
  `purpose`     VARCHAR(255),
  `time_in`     DATETIME NOT NULL,
  `time_out`    DATETIME NULL,
  `logged_by`   INT UNSIGNED NULL,
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`),
  FOREIGN KEY (`logged_by`)  REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- INVENTORY
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `inventory_items` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`     INT UNSIGNED NOT NULL,
  `item_code`     VARCHAR(20) NOT NULL,
  `name`          VARCHAR(150) NOT NULL,
  `category`      ENUM('stationery','furniture','lab','ict','sports','hostel','kitchen','medical','maintenance','other') NOT NULL,
  `unit`          VARCHAR(30) NOT NULL,
  `qty`           INT UNSIGNED DEFAULT 0,
  `min_qty`       INT UNSIGNED DEFAULT 0,
  `unit_cost`     DECIMAL(12,2) DEFAULT 0,
  `location`      VARCHAR(100),
  `supplier`      VARCHAR(150),
  `last_restocked` DATE NULL,
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`    DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  `deleted_at`    DATETIME NULL,
  UNIQUE KEY `uq_item_code` (`school_id`,`item_code`),
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `inventory_transactions` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `item_id`     INT UNSIGNED NOT NULL,
  `type`        ENUM('restock','issue') NOT NULL,
  `qty`         INT UNSIGNED NOT NULL,
  `issued_to`   VARCHAR(150),
  `purpose`     VARCHAR(255),
  `reference`   VARCHAR(100),
  `done_by`     INT UNSIGNED NULL,
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`item_id`) REFERENCES `inventory_items`(`id`),
  FOREIGN KEY (`done_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- MESSAGING & NOTIFICATIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `messages` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   INT UNSIGNED NOT NULL,
  `sender_id`   INT UNSIGNED NOT NULL,
  `thread_id`   INT UNSIGNED NULL,
  `subject`     VARCHAR(255),
  `body`        TEXT NOT NULL,
  `type`        ENUM('direct','announcement','sms') DEFAULT 'direct',
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`),
  FOREIGN KEY (`sender_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `message_recipients` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `message_id`  INT UNSIGNED NOT NULL,
  `recipient_id` INT UNSIGNED NOT NULL,
  `is_read`     TINYINT(1) DEFAULT 0,
  `read_at`     DATETIME NULL,
  FOREIGN KEY (`message_id`)   REFERENCES `messages`(`id`),
  FOREIGN KEY (`recipient_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `notifications` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `user_id`     INT UNSIGNED NOT NULL,
  `title`       VARCHAR(255) NOT NULL,
  `body`        TEXT,
  `type`        VARCHAR(50),
  `is_read`     TINYINT(1) DEFAULT 0,
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`user_id`) REFERENCES `users`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- LIBRARY
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `library_books` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`    INT UNSIGNED NOT NULL,
  `isbn`         VARCHAR(20),
  `title`        VARCHAR(255) NOT NULL,
  `author`       VARCHAR(150),
  `category`     VARCHAR(80),
  `total_copies` TINYINT UNSIGNED DEFAULT 1,
  `available`    TINYINT UNSIGNED DEFAULT 1,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `book_loans` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `book_id`     INT UNSIGNED NOT NULL,
  `student_id`  INT UNSIGNED NOT NULL,
  `issued_at`   DATE NOT NULL,
  `due_date`    DATE NOT NULL,
  `returned_at` DATE NULL,
  `fine`        DECIMAL(8,2) DEFAULT 0,
  FOREIGN KEY (`book_id`)    REFERENCES `library_books`(`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- TRANSPORT
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `transport_routes` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`  INT UNSIGNED NOT NULL,
  `name`       VARCHAR(100) NOT NULL,
  `bus_number` VARCHAR(30),
  `driver_name` VARCHAR(100),
  `driver_phone` VARCHAR(30),
  `capacity`   TINYINT UNSIGNED,
  `term_fee`   DECIMAL(10,2) DEFAULT 0,
  `is_active`  TINYINT(1) DEFAULT 1,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `student_transport` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`  INT UNSIGNED NOT NULL,
  `route_id`    INT UNSIGNED NOT NULL,
  `term_id`     INT UNSIGNED NOT NULL,
  `pickup_point` VARCHAR(150),
  UNIQUE KEY `uq_transport` (`student_id`,`term_id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`),
  FOREIGN KEY (`route_id`)   REFERENCES `transport_routes`(`id`),
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- ADMISSIONS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `admission_applications` (
  `id`             INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`      INT UNSIGNED NOT NULL,
  `first_name`     VARCHAR(80) NOT NULL,
  `last_name`      VARCHAR(80) NOT NULL,
  `date_of_birth`  DATE,
  `gender`         ENUM('male','female','other'),
  `apply_class`    VARCHAR(20),
  `guardian_name`  VARCHAR(150),
  `guardian_phone` VARCHAR(30),
  `guardian_email` VARCHAR(150),
  `previous_school` VARCHAR(150),
  `status`         ENUM('pending','approved','rejected','interview') DEFAULT 'pending',
  `docs_complete`  TINYINT(1) DEFAULT 0,
  `applied_at`     DATETIME DEFAULT CURRENT_TIMESTAMP,
  `reviewed_by`    INT UNSIGNED NULL,
  `reviewed_at`    DATETIME NULL,
  FOREIGN KEY (`school_id`)   REFERENCES `schools`(`id`),
  FOREIGN KEY (`reviewed_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- DISCIPLINARY
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `disciplinary_incidents` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`  INT UNSIGNED NOT NULL,
  `type`        VARCHAR(80) NOT NULL,
  `description` TEXT,
  `action`      VARCHAR(255),
  `incident_date` DATE NOT NULL,
  `status`      ENUM('open','resolved') DEFAULT 'open',
  `recorded_by` INT UNSIGNED NULL,
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`student_id`)  REFERENCES `students`(`id`),
  FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- STAFF LEAVE
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `leave_requests` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `staff_id`    INT UNSIGNED NOT NULL,
  `type`        VARCHAR(50) NOT NULL,
  `from_date`   DATE NOT NULL,
  `to_date`     DATE NOT NULL,
  `days`        TINYINT UNSIGNED NOT NULL,
  `reason`      TEXT,
  `status`      ENUM('pending','approved','rejected') DEFAULT 'pending',
  `approved_by` INT UNSIGNED NULL,
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`staff_id`)    REFERENCES `staff`(`id`),
  FOREIGN KEY (`approved_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- ────────────────────────────────────────────────────────────
-- CBT EXAMS
-- ────────────────────────────────────────────────────────────
CREATE TABLE IF NOT EXISTS `exams` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`    INT UNSIGNED NOT NULL,
  `class_id`     INT UNSIGNED NOT NULL,
  `subject_id`   INT UNSIGNED NOT NULL,
  `term_id`      INT UNSIGNED NOT NULL,
  `title`        VARCHAR(255) NOT NULL,
  `exam_type`    ENUM('mid-term','final','quiz','ca','practice') DEFAULT 'mid-term',
  `duration`     SMALLINT UNSIGNED DEFAULT 60,
  `total_marks`  SMALLINT UNSIGNED DEFAULT 100,
  `pass_mark`    SMALLINT UNSIGNED DEFAULT 50,
  `start_time`   DATETIME NULL,
  `end_time`     DATETIME NULL,
  `status`       ENUM('draft','active','completed','archived') DEFAULT 'draft',
  `shuffle_q`    TINYINT(1) DEFAULT 1,
  `shuffle_opts` TINYINT(1) DEFAULT 1,
  `created_by`   INT UNSIGNED NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`)  REFERENCES `schools`(`id`),
  FOREIGN KEY (`class_id`)   REFERENCES `classes`(`id`),
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`),
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `exam_questions` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `exam_id`     INT UNSIGNED NOT NULL,
  `type`        ENUM('mcq','short','essay','tf','fill') NOT NULL,
  `question`    TEXT NOT NULL,
  `options`     JSON NULL,
  `answer`      TEXT NULL,
  `marks`       TINYINT UNSIGNED DEFAULT 2,
  `sort_order`  SMALLINT UNSIGNED DEFAULT 0,
  FOREIGN KEY (`exam_id`) REFERENCES `exams`(`id`) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `exam_submissions` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `exam_id`     INT UNSIGNED NOT NULL,
  `student_id`  INT UNSIGNED NOT NULL,
  `answers`     JSON NOT NULL,
  `score`       DECIMAL(6,2) NULL,
  `submitted_at` DATETIME NOT NULL,
  `time_taken`  SMALLINT UNSIGNED,
  UNIQUE KEY `uq_submission` (`exam_id`,`student_id`),
  FOREIGN KEY (`exam_id`)    REFERENCES `exams`(`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET FOREIGN_KEY_CHECKS = 1;

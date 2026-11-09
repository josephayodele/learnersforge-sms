-- 013_assignments.sql
-- Online assignments: a teacher posts an assignment for a class (optionally a
-- subject), students submit text + an optional link, the teacher grades them.
-- Safe to run once on an existing database (no data loss).
CREATE TABLE IF NOT EXISTS `assignments` (
  `id`           INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`    INT UNSIGNED NOT NULL,
  `class_id`     INT UNSIGNED NOT NULL,
  `subject_id`   INT UNSIGNED NULL,
  `term_id`      INT UNSIGNED NULL,
  `title`        VARCHAR(200) NOT NULL,
  `instructions` TEXT NULL,
  `resource_url` VARCHAR(500) NULL,
  `due_date`     DATE NULL,
  `max_marks`    INT UNSIGNED NOT NULL DEFAULT 100,
  `created_by`   INT UNSIGNED NULL,
  `created_at`   DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`   DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_assign_class` (`class_id`),
  FOREIGN KEY (`school_id`)  REFERENCES `schools`(`id`),
  FOREIGN KEY (`class_id`)   REFERENCES `classes`(`id`),
  FOREIGN KEY (`subject_id`) REFERENCES `subjects`(`id`),
  FOREIGN KEY (`created_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `assignment_submissions` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `assignment_id` INT UNSIGNED NOT NULL,
  `student_id`    INT UNSIGNED NOT NULL,
  `content`       TEXT NULL,
  `link_url`      VARCHAR(500) NULL,
  `submitted_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  `marks`         DECIMAL(6,2) NULL,
  `feedback`      TEXT NULL,
  `graded_by`     INT UNSIGNED NULL,
  `graded_at`     DATETIME NULL,
  UNIQUE KEY `uq_assub` (`assignment_id`,`student_id`),
  FOREIGN KEY (`assignment_id`) REFERENCES `assignments`(`id`) ON DELETE CASCADE,
  FOREIGN KEY (`student_id`)    REFERENCES `students`(`id`),
  FOREIGN KEY (`graded_by`)     REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

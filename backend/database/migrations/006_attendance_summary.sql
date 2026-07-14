-- ============================================================
-- Migration 006 — per-term attendance summary for report cards
-- ------------------------------------------------------------
-- Lets a teacher enter, per student per term, the totals that appear on the
-- report sheet: times present, times absent, and the number of times the school
-- opened (total attendance days). The report card uses these manual figures
-- when present, otherwise falls back to the counts derived from daily attendance.
-- Safe to run on an existing database (no data loss).
-- ============================================================

CREATE TABLE IF NOT EXISTS `attendance_summary` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `student_id`  INT UNSIGNED NOT NULL,
  `term_id`     INT UNSIGNED NOT NULL,
  `present`     INT UNSIGNED DEFAULT NULL,
  `absent`      INT UNSIGNED DEFAULT NULL,
  `days_opened` INT UNSIGNED DEFAULT NULL,
  `updated_at`  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_att_summary` (`student_id`, `term_id`),
  KEY `idx_term` (`term_id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`),
  FOREIGN KEY (`term_id`)    REFERENCES `terms`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- 018_exam_time.sql — server-authoritative exam timing.
--   exam_attempts : records when each student STARTED an exam (its first fetch),
--                   so the server can derive and enforce the deadline
--                   (started_at + exams.duration) independently of the client clock.
--   exam_submissions.auto_submitted : 1 when the SERVER closed an expired attempt
--                   itself (student ran out of time / never submitted), vs a normal
--                   student submission (0).
--
-- NOTE: CREATE TABLE IF NOT EXISTS works on MySQL; the ADD COLUMN is applied
-- conditionally via information_schema because MySQL has no ADD COLUMN IF NOT
-- EXISTS. Safe to run more than once, on both MySQL and MariaDB.

CREATE TABLE IF NOT EXISTS `exam_attempts` (
  `id`         INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `exam_id`    INT UNSIGNED NOT NULL,
  `student_id` INT UNSIGNED NOT NULL,
  `started_at` DATETIME NOT NULL,
  UNIQUE KEY `uq_attempt` (`exam_id`,`student_id`),
  FOREIGN KEY (`exam_id`)    REFERENCES `exams`(`id`),
  FOREIGN KEY (`student_id`) REFERENCES `students`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'exam_submissions' AND COLUMN_NAME = 'auto_submitted');
SET @s := IF(@c = 0, 'ALTER TABLE `exam_submissions` ADD COLUMN `auto_submitted` TINYINT(1) NOT NULL DEFAULT 0', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

-- 012_staff_attendance.sql
-- Daily staff attendance for the HR module (the existing `attendance` table is
-- for students). One row per staff per day; re-marking updates in place.
-- Safe to run once on an existing database (no data loss).
CREATE TABLE IF NOT EXISTS `staff_attendance` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `staff_id`    INT UNSIGNED NOT NULL,
  `date`        DATE NOT NULL,
  `status`      ENUM('present','absent','late','leave','holiday') NOT NULL DEFAULT 'present',
  `check_in`    TIME NULL,
  `remark`      VARCHAR(255) NULL,
  `recorded_by` INT UNSIGNED NULL,
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  UNIQUE KEY `uq_staff_att` (`staff_id`,`date`),
  KEY `idx_staff_att_date` (`date`),
  FOREIGN KEY (`staff_id`)    REFERENCES `staff`(`id`),
  FOREIGN KEY (`recorded_by`) REFERENCES `users`(`id`) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

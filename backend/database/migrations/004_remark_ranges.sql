-- ============================================================
-- Migration 004 — report-card remark ranges
-- ------------------------------------------------------------
-- Lets an administrator define, per school, the Class Teacher's and
-- Head Teacher's remarks that appear on a report card. Each row is a
-- score band (min_score..max_score, inclusive, as an overall %) mapped
-- to a remark. The report-card endpoint picks the band the student's
-- overall percentage falls into and fills the remark automatically.
-- Safe to run on an existing database (no data loss).
-- ============================================================

CREATE TABLE IF NOT EXISTS `remark_ranges` (
  `id`          INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`   INT UNSIGNED NOT NULL,
  `remark_type` ENUM('class_teacher','head_teacher') NOT NULL,
  `min_score`   DECIMAL(5,2) NOT NULL,
  `max_score`   DECIMAL(5,2) NOT NULL,
  `remark`      TEXT NOT NULL,
  `created_at`  DATETIME DEFAULT CURRENT_TIMESTAMP,
  `updated_at`  DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP,
  KEY `idx_remark_lookup` (`school_id`, `remark_type`, `min_score`, `max_score`),
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

-- Sensible defaults for school #1 so report cards are populated out of the box.
INSERT INTO `remark_ranges` (`school_id`, `remark_type`, `min_score`, `max_score`, `remark`) VALUES
  (1, 'class_teacher', 70.00, 100.00, 'An excellent result. A hardworking and focused student - keep it up!'),
  (1, 'class_teacher', 60.00, 69.99,  'A very good performance. With more effort you will reach the top.'),
  (1, 'class_teacher', 50.00, 59.99,  'A good result, but there is room for improvement. Work harder.'),
  (1, 'class_teacher', 40.00, 49.99,  'A fair result. You need to be more serious with your studies.'),
  (1, 'class_teacher', 0.00,  39.99,  'A weak result. Please put in much more effort next term.'),
  (1, 'head_teacher',  70.00, 100.00, 'Outstanding! A commendable performance. We are proud of you.'),
  (1, 'head_teacher',  60.00, 69.99,  'A very good result. Keep up the good work.'),
  (1, 'head_teacher',  50.00, 59.99,  'A satisfactory result. Aim higher next term.'),
  (1, 'head_teacher',  40.00, 49.99,  'You can do better. More commitment is required.'),
  (1, 'head_teacher',  0.00,  39.99,  'This result is below expectation. Extra support is advised.');

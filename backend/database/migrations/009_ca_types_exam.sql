-- 009_ca_types_exam.sql
-- Make CA components configurable: mark which component is the Exam explicitly,
-- instead of guessing from the label containing "exam".
ALTER TABLE `ca_types`
  ADD COLUMN `is_exam` TINYINT(1) NOT NULL DEFAULT 0 AFTER `is_enabled`;

-- Backfill: any existing component whose label mentions "exam" is the exam.
UPDATE `ca_types` SET `is_exam` = 1 WHERE `label` LIKE '%exam%';

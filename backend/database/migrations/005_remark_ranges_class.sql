-- ============================================================
-- Migration 005 — class-specific report-card remark ranges
-- ------------------------------------------------------------
-- Adds an optional class scope to remark_ranges. A row with class_id
-- NULL is the school-wide default; a row with a class_id applies only
-- to that class and takes precedence over the school-wide band on a
-- report card. Class teachers (classes.form_teacher_id) may manage
-- their own class's ranges; admins manage everything.
-- Safe to run on an existing database (no data loss).
-- ============================================================

ALTER TABLE `remark_ranges`
  ADD COLUMN `class_id` INT UNSIGNED NULL AFTER `school_id`,
  ADD KEY `idx_class_lookup` (`school_id`, `class_id`, `remark_type`, `min_score`, `max_score`),
  ADD CONSTRAINT `fk_remark_class` FOREIGN KEY (`class_id`) REFERENCES `classes`(`id`) ON DELETE CASCADE;

-- 017_cgpa_class.sql — make CGPA / grade-point grading opt-in PER CLASS.
--   classes.cgpa_enabled : 0/1 — does this class use the school's CGPA scheme?
-- The scale + score→point bands stay school-wide (schools.cgpa_scale / cgpa_bands,
-- migration 016). A report card / broadsheet shows the GPA only when the school's
-- master switch (schools.cgpa_enabled) AND this class's flag are both on. Admins
-- tick the classes in Settings → CGPA.
--
-- NOTE: Bluehost runs MySQL, which does NOT support `ADD COLUMN IF NOT EXISTS`.
-- The column is added conditionally via information_schema, so this file is safe
-- to run more than once on both MySQL and MariaDB.

SET @c := (SELECT COUNT(*) FROM information_schema.COLUMNS
           WHERE TABLE_SCHEMA = DATABASE() AND TABLE_NAME = 'classes' AND COLUMN_NAME = 'cgpa_enabled');
SET @s := IF(@c = 0, 'ALTER TABLE `classes` ADD COLUMN `cgpa_enabled` TINYINT(1) NOT NULL DEFAULT 0', 'DO 0');
PREPARE st FROM @s; EXECUTE st; DEALLOCATE PREPARE st;

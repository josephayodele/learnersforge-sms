-- 016_cgpa_grading.sql — optional CGPA / grade-point grading, per school.
--   cgpa_enabled : 0/1 master switch (admin turns it on in Settings).
--   cgpa_scale   : the maximum grade point (e.g. 5.0, 7.0, 4.0).
--   cgpa_bands   : JSON array of score→point bands, e.g.
--                  [{"grade":"A","min":70,"point":5},{"grade":"B","min":60,"point":4}, ...]
-- When enabled, report cards and the broadsheet show each subject's grade point and
-- the term GPA (simple average of the subject points). Safe to run more than once.
ALTER TABLE `schools`
  ADD COLUMN IF NOT EXISTS `cgpa_enabled` TINYINT(1) NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS `cgpa_scale`   DECIMAL(3,1) NOT NULL DEFAULT 5.0,
  ADD COLUMN IF NOT EXISTS `cgpa_bands`   TEXT NULL;

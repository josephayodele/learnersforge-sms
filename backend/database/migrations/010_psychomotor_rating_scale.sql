-- 010_psychomotor_rating_scale.sql
-- The psychomotor/affective rating dropdown now uses a numeric 5–1 scale
-- (5 = highest) instead of the old Excellent…Poor text. The `rating` column
-- was an ENUM of the old text values, so numeric ratings were being rejected
-- and nothing saved. Widen it to a short VARCHAR that accepts both the new
-- numbers and any legacy text already stored (the report card maps either).
--
-- Safe to run once. Existing ENUM values are preserved as their text.
ALTER TABLE `psychomotor`
  MODIFY COLUMN `rating` VARCHAR(20) NULL;

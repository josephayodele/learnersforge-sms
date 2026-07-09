-- ============================================================
-- Migration 003 — widen schools.logo_url to hold an embedded logo
-- ------------------------------------------------------------
-- The Settings screen lets an admin upload a school logo, which is
-- stored inline as a data:image/...;base64 URL (client-downscaled).
-- VARCHAR(255) is too small for that, so widen the column to MEDIUMTEXT.
-- Safe to run on an existing database (no data loss).
-- ============================================================

ALTER TABLE `schools`
  MODIFY COLUMN `logo_url` MEDIUMTEXT NULL;

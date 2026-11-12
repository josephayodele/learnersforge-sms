-- 015_platform_control.sql — HQ (group control-plane) on/off switch for THIS school.
--   platform_control : a single-row table HQ writes to in order to suspend/resume
--                      this school. The API reads it on every request and, when
--                      status = 'suspended', returns 503 for all calls.
-- The check is FAIL-OPEN: if this table or row is missing, the school stays ACTIVE,
-- so a problem in HQ can never black out every school at once.
-- Safe to run more than once (IF NOT EXISTS / ON DUPLICATE KEY).

CREATE TABLE IF NOT EXISTS `platform_control` (
  `id`         TINYINT UNSIGNED NOT NULL PRIMARY KEY DEFAULT 1,
  `status`     ENUM('active','suspended') NOT NULL DEFAULT 'active',
  `message`    VARCHAR(255) NULL,
  `updated_by` VARCHAR(190) NULL,
  `updated_at` DATETIME DEFAULT CURRENT_TIMESTAMP ON UPDATE CURRENT_TIMESTAMP
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT INTO `platform_control` (`id`, `status`) VALUES (1, 'active')
  ON DUPLICATE KEY UPDATE `id` = `id`;

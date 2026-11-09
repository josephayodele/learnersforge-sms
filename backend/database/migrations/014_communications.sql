-- 014_communications.sql — Communications module.
--   events                    : school events that can trigger reminders
--   communications            : one row per broadcast (ad-hoc notice or event reminder)
--   communication_recipients  : per-recipient delivery log (email / whatsapp)
-- Safe to run more than once (IF NOT EXISTS).

CREATE TABLE IF NOT EXISTS `events` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`        INT UNSIGNED NOT NULL,
  `title`            VARCHAR(160) NOT NULL,
  `description`      TEXT,
  `event_date`       DATE NOT NULL,
  `audience`         VARCHAR(30) NOT NULL DEFAULT 'all_guardians',
  `class_id`         INT UNSIGNED NULL,
  `reminder_sent_at` DATETIME NULL,
  `created_by`       INT UNSIGNED NULL,
  `created_at`       DATETIME DEFAULT CURRENT_TIMESTAMP,
  `deleted_at`       DATETIME NULL,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `communications` (
  `id`            INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `school_id`     INT UNSIGNED NOT NULL,
  `sender_id`     INT UNSIGNED NULL,
  `kind`          ENUM('notice','reminder') NOT NULL DEFAULT 'notice',
  `event_id`      INT UNSIGNED NULL,
  `subject`       VARCHAR(255),
  `body`          TEXT NOT NULL,
  `audience`      VARCHAR(30) NOT NULL,
  `class_id`      INT UNSIGNED NULL,
  `channels`      VARCHAR(40) NOT NULL DEFAULT 'email',
  `recipients`    INT UNSIGNED NOT NULL DEFAULT 0,
  `sent_email`    INT UNSIGNED NOT NULL DEFAULT 0,
  `sent_whatsapp` INT UNSIGNED NOT NULL DEFAULT 0,
  `failed`        INT UNSIGNED NOT NULL DEFAULT 0,
  `skipped`       INT UNSIGNED NOT NULL DEFAULT 0,
  `created_at`    DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`school_id`) REFERENCES `schools`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS `communication_recipients` (
  `id`               INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  `communication_id` INT UNSIGNED NOT NULL,
  `name`             VARCHAR(160),
  `channel`          ENUM('email','whatsapp') NOT NULL,
  `destination`      VARCHAR(190),
  `status`           ENUM('sent','failed','skipped') NOT NULL,
  `error`            VARCHAR(255),
  `created_at`       DATETIME DEFAULT CURRENT_TIMESTAMP,
  FOREIGN KEY (`communication_id`) REFERENCES `communications`(`id`)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

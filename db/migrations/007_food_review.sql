-- Run once against your database (phpMyAdmin -> SQL tab) after 006.
--
-- Keeps track of which shared foods (AI Assist / My Entry foods that several
-- opted-in users made independently) the admin has already been sent or has
-- decided on, so the twice-monthly digest never repeats itself.
CREATE TABLE IF NOT EXISTS food_review_log (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  norm_key VARCHAR(190) NOT NULL,
  unit_kind VARCHAR(8) NOT NULL DEFAULT 'g',
  decision VARCHAR(20) NOT NULL DEFAULT 'sent', -- sent | reviewed | dismissed
  users_at_time INT UNSIGNED NOT NULL DEFAULT 0,
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_review_key (norm_key, unit_kind)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

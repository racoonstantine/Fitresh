-- Apply after 003_nutrition_engine.sql. Existing food/log rows are untouched.
CREATE TABLE IF NOT EXISTS personal_food_versions (
  food_id INT UNSIGNED PRIMARY KEY,
  owner_user_id INT UNSIGNED NOT NULL,
  root_food_id INT UNSIGNED NOT NULL,
  revision INT UNSIGNED NOT NULL,
  is_current TINYINT NOT NULL DEFAULT 1,
  definition LONGTEXT NOT NULL,
  request_key VARCHAR(36) NOT NULL,
  request_hash CHAR(64) NOT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  UNIQUE KEY personal_request (owner_user_id, request_key),
  UNIQUE KEY personal_revision (root_food_id, revision),
  KEY personal_current (owner_user_id, is_current),
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS food_submissions (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  food_id INT UNSIGNED NOT NULL UNIQUE,
  owner_user_id INT UNSIGNED NOT NULL,
  snapshot LONGTEXT NOT NULL,
  status VARCHAR(24) NOT NULL DEFAULT 'pending',
  review_note TEXT NULL,
  created_at DATETIME NOT NULL DEFAULT CURRENT_TIMESTAMP,
  reviewed_at DATETIME NULL,
  KEY submissions_status (status, created_at),
  FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
  FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

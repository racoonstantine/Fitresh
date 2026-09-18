-- Run after the base schema. Safe to rerun; no legacy user_data is modified.
CREATE TABLE IF NOT EXISTS workout_activities (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  category VARCHAR(24) NOT NULL,
  definition LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workout_templates (
  id VARCHAR(64) PRIMARY KEY,
  name VARCHAR(140) NOT NULL,
  definition LONGTEXT NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workout_sessions (
  id CHAR(36) PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  session_date DATE NOT NULL,
  title VARCHAR(140) NOT NULL,
  style VARCHAR(24) NOT NULL,
  notes TEXT NOT NULL,
  source VARCHAR(32) NOT NULL DEFAULT 'manual',
  external_id VARCHAR(190) NULL,
  timezone VARCHAR(80) NOT NULL,
  created_at DATETIME NOT NULL,
  UNIQUE KEY workout_external (user_id, source, external_id),
  KEY workout_user_date (user_id, session_date),
  FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workout_session_items (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  session_id CHAR(36) NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  activity_id VARCHAR(64) NOT NULL,
  snapshot LONGTEXT NOT NULL,
  metrics LONGTEXT NOT NULL,
  FOREIGN KEY (session_id) REFERENCES workout_sessions(id) ON DELETE CASCADE,
  FOREIGN KEY (activity_id) REFERENCES workout_activities(id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS workout_sets (
  id BIGINT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  item_id BIGINT UNSIGNED NOT NULL,
  position SMALLINT UNSIGNED NOT NULL,
  reps SMALLINT UNSIGNED NULL,
  weight_kg DECIMAL(9,3) NULL,
  duration_seconds INT UNSIGNED NULL,
  FOREIGN KEY (item_id) REFERENCES workout_session_items(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

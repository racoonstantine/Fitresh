-- Run this once against your database (phpMyAdmin -> shergtjz_fitness -> SQL tab).
--
-- Foundation for the real nutrition engine (see
-- RandomHut_Nutrition_Tracking_Requirements_v1.0.docx): a normalized food/
-- nutrient model instead of the old flat "one JSON row per day" nutritionLog.
-- The old data (api/data.php resource 'nutrition') is untouched and keeps
-- showing in History/Trends for anything logged before this -- new logging
-- goes through these tables instead.

CREATE TABLE IF NOT EXISTS nutrients (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  code VARCHAR(32) NOT NULL UNIQUE,
  name VARCHAR(100) NOT NULL,
  unit VARCHAR(16) NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

INSERT IGNORE INTO nutrients (code, name, unit) VALUES
  ('ENERC_KCAL', 'Calories', 'kcal'),
  ('PROCNT', 'Protein', 'g'),
  ('FAT', 'Fat', 'g'),
  ('CHOCDF', 'Carbohydrate', 'g'),
  ('FIBTG', 'Fiber', 'g'),
  ('SUGAR', 'Sugar', 'g'),
  ('FASAT', 'Saturated Fat', 'g'),
  ('NA', 'Sodium', 'mg'),
  ('CHOLE', 'Cholesterol', 'mg'),
  ('K', 'Potassium', 'mg'),
  ('CA', 'Calcium', 'mg'),
  ('FE', 'Iron', 'mg');

CREATE TABLE IF NOT EXISTS foods (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  owner_user_id INT UNSIGNED NULL,
  source VARCHAR(20) NOT NULL,
  external_id VARCHAR(64) NULL,
  name VARCHAR(200) NOT NULL,
  brand VARCHAR(150) NULL,
  canonical_amount DECIMAL(10,2) NOT NULL DEFAULT 100,
  canonical_unit VARCHAR(8) NOT NULL DEFAULT 'g',
  created_at DATETIME NOT NULL,
  updated_at DATETIME NOT NULL,
  CONSTRAINT fk_foods_owner FOREIGN KEY (owner_user_id) REFERENCES users(id) ON DELETE CASCADE,
  UNIQUE KEY uniq_source_external (source, external_id)
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_foods_name ON foods(name);

CREATE TABLE IF NOT EXISTS food_nutrients (
  food_id INT UNSIGNED NOT NULL,
  nutrient_id INT UNSIGNED NOT NULL,
  value_per_canonical DECIMAL(12,4) NOT NULL,
  PRIMARY KEY (food_id, nutrient_id),
  CONSTRAINT fk_fn_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE,
  CONSTRAINT fk_fn_nutrient FOREIGN KEY (nutrient_id) REFERENCES nutrients(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS food_servings (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  food_id INT UNSIGNED NOT NULL,
  label VARCHAR(80) NOT NULL,
  grams DECIMAL(10,2) NOT NULL,
  CONSTRAINT fk_fs_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS meal_entries (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  entry_date DATE NOT NULL,
  meal_type VARCHAR(20) NOT NULL,
  display_name VARCHAR(200) NULL,
  created_at DATETIME NOT NULL,
  CONSTRAINT fk_me_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE INDEX idx_meal_entries_user_date ON meal_entries(user_id, entry_date);

CREATE TABLE IF NOT EXISTS meal_components (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  meal_entry_id INT UNSIGNED NOT NULL,
  food_id INT UNSIGNED NULL,
  custom_name VARCHAR(200) NULL,
  amount DECIMAL(10,2) NOT NULL,
  unit VARCHAR(8) NOT NULL DEFAULT 'g',
  manual_calories DECIMAL(10,2) NULL,
  manual_protein DECIMAL(10,2) NULL,
  manual_fat DECIMAL(10,2) NULL,
  manual_carbs DECIMAL(10,2) NULL,
  source VARCHAR(20) NOT NULL DEFAULT 'database',
  sort_order INT UNSIGNED NOT NULL DEFAULT 0,
  CONSTRAINT fk_mc_entry FOREIGN KEY (meal_entry_id) REFERENCES meal_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_mc_food FOREIGN KEY (food_id) REFERENCES foods(id) ON DELETE SET NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

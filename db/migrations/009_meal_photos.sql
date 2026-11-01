-- Run after 008. Safe to rerun. Keeps one small photo (about 400 px, a few tens of KB) per meal entry for
-- 7 days, plus the AI's one-line analysis. After 7 days api/meal_photo.php clears the image and keeps the text.
-- (Until this is run, meals.php and the app still work; photo meals just have no thumbnail.)
CREATE TABLE IF NOT EXISTS meal_photos (
  meal_entry_id INT UNSIGNED NOT NULL PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  mime VARCHAR(20) NULL,
  image MEDIUMBLOB NULL,
  summary VARCHAR(400) NULL,
  confidence VARCHAR(10) NULL,
  created_at DATETIME NOT NULL,
  KEY idx_meal_photos_user_created (user_id, created_at),
  CONSTRAINT fk_meal_photos_entry FOREIGN KEY (meal_entry_id) REFERENCES meal_entries(id) ON DELETE CASCADE,
  CONSTRAINT fk_meal_photos_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

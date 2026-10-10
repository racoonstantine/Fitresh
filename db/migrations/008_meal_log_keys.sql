-- Run after 007. Safe to rerun. Lets a phone that was offline replay a queued meal log without
-- ever logging it twice: api/meals.php remembers each client_key it has already applied.
-- (Until this is run, meals.php still works; it just cannot de-duplicate replayed logs.)
CREATE TABLE IF NOT EXISTS meal_log_keys (
  user_id INT UNSIGNED NOT NULL,
  client_key VARCHAR(64) NOT NULL,
  meal_entry_id INT UNSIGNED NULL,
  created_at DATETIME NOT NULL,
  PRIMARY KEY (user_id, client_key),
  CONSTRAINT fk_meal_log_keys_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

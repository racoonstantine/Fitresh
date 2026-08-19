-- Run this once against your Namecheap MySQL database (phpMyAdmin -> SQL tab,
-- or the mysql CLI if you have it) after creating the database in cPanel.

CREATE TABLE IF NOT EXISTS users (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  email VARCHAR(190) NOT NULL UNIQUE,
  password_hash VARCHAR(255) NOT NULL,
  display_name VARCHAR(100) NOT NULL,
  created_at DATETIME NOT NULL
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

CREATE TABLE IF NOT EXISTS user_data (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  resource_key VARCHAR(32) NOT NULL,
  value LONGTEXT NOT NULL,
  updated_at DATETIME NOT NULL,
  UNIQUE KEY uniq_user_resource (user_id, resource_key),
  CONSTRAINT fk_user_data_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

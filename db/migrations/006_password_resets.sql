-- Run after the base schema. Safe to rerun; no existing user_data is modified.
CREATE TABLE IF NOT EXISTS password_resets (
  id INT UNSIGNED AUTO_INCREMENT PRIMARY KEY,
  user_id INT UNSIGNED NOT NULL,
  -- Sent to the admin to approve/reject the request.
  admin_token VARCHAR(64) NOT NULL,
  -- Generated only once the admin approves; sent to the user so they can
  -- actually set a new password. NULL until approval.
  user_token VARCHAR(64) NULL,
  status VARCHAR(20) NOT NULL DEFAULT 'pending', -- pending | approved | rejected | completed
  requested_at DATETIME NOT NULL,
  approved_at DATETIME NULL,
  completed_at DATETIME NULL,
  expires_at DATETIME NOT NULL,
  UNIQUE KEY uniq_admin_token (admin_token),
  UNIQUE KEY uniq_user_token (user_token),
  KEY idx_user_status (user_id, status),
  CONSTRAINT fk_password_resets_user FOREIGN KEY (user_id) REFERENCES users(id) ON DELETE CASCADE
) ENGINE=InnoDB DEFAULT CHARSET=utf8mb4;

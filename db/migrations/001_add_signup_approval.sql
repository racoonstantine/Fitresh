-- Run this once against your existing database (phpMyAdmin -> shergtjz_fitness -> SQL tab)
-- to add admin-approval gating to signups.
--
-- DEFAULT 'approved' means every account that already exists (including yours)
-- stays exactly as it is -- only brand new signups after this point start out
-- as 'pending' (auth.php sets that explicitly on INSERT).

ALTER TABLE users
  ADD COLUMN status VARCHAR(20) NOT NULL DEFAULT 'approved',
  ADD COLUMN approval_token VARCHAR(64) NULL;

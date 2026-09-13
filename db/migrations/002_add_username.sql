-- Run this once against your database (phpMyAdmin -> shergtjz_fitness -> SQL tab)
-- to add an optional, unique username to accounts.
--
-- NULL is allowed so existing accounts (created before this feature) aren't
-- broken -- they just don't have a username set until they choose one.

ALTER TABLE users
  ADD COLUMN username VARCHAR(30) NULL UNIQUE;

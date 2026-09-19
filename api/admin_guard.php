<?php
declare(strict_types=1);

// Hardcoded on purpose for now, per the owner's request -- a small, private
// console for a single-admin invite-only app. If this ever needs more than
// one admin, move this to an `is_admin` column on `users` instead of
// growing this list.
const ADMIN_EMAILS = ['sherwinllona@gmail.com'];

// Returns the admin's user id, or answers 401/403 and stops. The admin's email
// is re-read from the DB on every request rather than trusting anything
// client-supplied or cached in the session, so it can't be spoofed by
// editing session/local state.
function require_admin_user(PDO $pdo): int
{
    if (empty($_SESSION['user_id'])) {
        json_respond(['error' => 'Not logged in'], 401);
    }
    $userId = (int)$_SESSION['user_id'];
    $stmt = $pdo->prepare('SELECT email FROM users WHERE id = ?');
    $stmt->execute([$userId]);
    $me = $stmt->fetch();
    if (!$me || !in_array(strtolower((string)$me['email']), ADMIN_EMAILS, true)) {
        json_respond(['error' => 'Not authorized'], 403);
    }
    return $userId;
}

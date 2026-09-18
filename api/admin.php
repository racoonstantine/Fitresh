<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

header('Content-Type: application/json');
start_app_session();
require_json_request();

if (empty($_SESSION['user_id'])) {
    json_respond(['error' => 'Not logged in'], 401);
}

// Hardcoded on purpose for now, per the owner's request -- a small, private
// console for a single-admin invite-only app. If this ever needs more than
// one admin, move this to an `is_admin` column on `users` instead of
// growing this list.
const ADMIN_EMAILS = ['sherwin.llona@gmail.com'];

$pdo = get_db();
$userId = (int)$_SESSION['user_id'];

// Re-check the admin's own email fresh from the DB on every request rather
// than trusting anything client-supplied or cached in the session, so this
// can't be spoofed by editing session/local state.
$stmt = $pdo->prepare('SELECT email FROM users WHERE id = ?');
$stmt->execute([$userId]);
$me = $stmt->fetch();
if (!$me || !in_array(strtolower((string)$me['email']), ADMIN_EMAILS, true)) {
    json_respond(['error' => 'Not authorized'], 403);
}

$method = $_SERVER['REQUEST_METHOD'];
$input = $method === 'POST' ? (json_decode(file_get_contents('php://input'), true) ?? []) : [];
$action = $method === 'GET' ? (string)($_GET['action'] ?? '') : (string)($input['action'] ?? '');

if ($method === 'GET' && $action === 'overview') {
    $users = $pdo->query(
        'SELECT id, email, username, display_name, status, created_at FROM users ORDER BY created_at DESC'
    )->fetchAll();

    // "Days logged" is intentionally scoped to the new search-based food log
    // (meal_entries) -- the one activity metric available from a normal SQL
    // COUNT without parsing every account's legacy JSON blobs. It undercounts
    // anyone who only ever used the old quick-log/manual flows; a fuller
    // picture would need a purpose-built activity table.
    $counts = [];
    foreach ($pdo->query('SELECT user_id, COUNT(DISTINCT entry_date) AS days FROM meal_entries GROUP BY user_id') as $row) {
        $counts[(int)$row['user_id']] = (int)$row['days'];
    }

    $out = array_map(function ($u) use ($counts) {
        return [
            'id' => (int)$u['id'],
            'email' => $u['email'],
            'username' => $u['username'],
            'display_name' => $u['display_name'],
            'status' => $u['status'],
            'created_at' => $u['created_at'],
            'days_logged' => $counts[(int)$u['id']] ?? 0,
        ];
    }, $users);

    json_respond(['users' => $out]);
}

if ($method === 'POST' && $action === 'reset_password') {
    $targetId = (int)($input['user_id'] ?? 0);
    if ($targetId <= 0) {
        json_respond(['error' => 'Invalid user'], 400);
    }
    $stmt = $pdo->prepare('SELECT id, email FROM users WHERE id = ?');
    $stmt->execute([$targetId]);
    $target = $stmt->fetch();
    if (!$target) {
        json_respond(['error' => 'User not found'], 404);
    }

    // Random temporary password -- shown once to the admin here, never
    // emailed automatically (no email-verification flow exists yet to
    // safely automate that -- see README). The admin relays it to the user
    // directly; a self-service change-password option is a follow-up.
    $tempPassword = bin2hex(random_bytes(9)); // 18 hex chars
    $hash = password_hash($tempPassword, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $targetId]);

    json_respond(['ok' => true, 'email' => $target['email'], 'temp_password' => $tempPassword]);
}

json_respond(['error' => 'Unknown action'], 400);

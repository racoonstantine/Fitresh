<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

// Reached only via the link in the admin approval email. The random 64-char
// token (not a login session) is what authorizes this action -- anyone who
// knows the token could use it, but it's only ever sent to admin_email and
// is invalidated after first use, same trust model as a typical email
// "confirm" or "unsubscribe" link.

header('Content-Type: text/html; charset=utf-8');

$token = (string)($_GET['token'] ?? '');
$action = (string)($_GET['action'] ?? '');

function render_page(string $message): void
{
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Full Circle</title>'
        . '<style>body{font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#1F2A24}</style>'
        . '</head><body><h2>Full Circle</h2><p>' . htmlspecialchars($message) . '</p></body></html>';
    exit;
}

if (!in_array($action, ['approve', 'reject'], true) || $token === '') {
    render_page('Invalid request.');
}

$pdo = get_db();
$stmt = $pdo->prepare('SELECT id, email, display_name FROM users WHERE approval_token = ? AND status = ?');
$stmt->execute([$token, 'pending']);
$user = $stmt->fetch();

if (!$user) {
    render_page('This request was already handled, or the link is invalid.');
}

$newStatus = $action === 'approve' ? 'approved' : 'rejected';
$stmt = $pdo->prepare('UPDATE users SET status = ?, approval_token = NULL WHERE id = ?');
$stmt->execute([$newStatus, $user['id']]);

$verb = $action === 'approve' ? 'approved' : 'rejected';
render_page("{$user['display_name']} ({$user['email']}) has been {$verb}.");

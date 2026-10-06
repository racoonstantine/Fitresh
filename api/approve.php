<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

// Reached only via the link in the admin approval email. The random 64-char
// token (not a login session) is what authorizes this action -- anyone who
// knows the token could use it, but it's only ever sent to admin_email and
// is invalidated after first use, same trust model as a typical email
// "confirm" or "unsubscribe" link.

header('Content-Type: text/html; charset=utf-8');

$isPost = ($_SERVER['REQUEST_METHOD'] ?? '') === 'POST';
$token = (string)($isPost ? ($_POST['token'] ?? '') : ($_GET['token'] ?? ''));
$action = (string)($isPost ? ($_POST['action'] ?? '') : ($_GET['action'] ?? ''));

// Email link scanners and link previews open every URL in a message with a
// plain GET. A GET must therefore never change anything: it only shows a
// confirmation page, and the change happens when the button (a POST) is used.
function render_confirm(string $question, string $buttonLabel, string $token, string $action): void
{
    echo '<!doctype html><html><head><meta charset="utf-8"><meta name="viewport" content="width=device-width,initial-scale=1"><title>Fitresh</title>'
        . '<style>body{font-family:sans-serif;max-width:480px;margin:80px auto;padding:0 16px;text-align:center;color:#1F2A24}'
        . 'button{padding:12px 28px;border:none;border-radius:8px;background:#2F6F4E;color:#fff;font-size:16px;cursor:pointer}</style>'
        . '</head><body><h2>Fitresh</h2><p>' . htmlspecialchars($question) . '</p>'
        . '<form method="post"><input type="hidden" name="token" value="' . htmlspecialchars($token) . '">'
        . '<input type="hidden" name="action" value="' . htmlspecialchars($action) . '">'
        . '<button type="submit">' . htmlspecialchars($buttonLabel) . '</button></form></body></html>';
    exit;
}

function render_page(string $message): void
{
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Fitresh</title>'
        . '<style>body{font-family:sans-serif;max-width:480px;margin:80px auto;text-align:center;color:#1F2A24}</style>'
        . '</head><body><h2>Fitresh</h2><p>' . htmlspecialchars($message) . '</p></body></html>';
    exit;
}

if (!in_array($action, ['approve', 'reject'], true) || $token === '') {
    render_page('Invalid request.');
}

$pdo = get_db();
// Tokens are stored hashed; the raw form is also accepted for signups that
// were requested before hashing was introduced.
$stmt = $pdo->prepare('SELECT id, email, display_name FROM users WHERE approval_token IN (?, ?) AND status = ?');
$stmt->execute([token_hash($token), $token, 'pending']);
$user = $stmt->fetch();

if (!$user) {
    render_page('This request was already handled, or the link is invalid.');
}

if (!$isPost) {
    $who = "{$user['display_name']} ({$user['email']})";
    render_confirm(
        $action === 'approve' ? "Approve the signup for {$who}?" : "Reject the signup for {$who}?",
        $action === 'approve' ? 'Approve signup' : 'Reject signup',
        $token,
        $action
    );
}

$newStatus = $action === 'approve' ? 'approved' : 'rejected';
$stmt = $pdo->prepare('UPDATE users SET status = ?, approval_token = NULL WHERE id = ?');
$stmt->execute([$newStatus, $user['id']]);

$verb = $action === 'approve' ? 'approved' : 'rejected';
render_page("{$user['display_name']} ({$user['email']}) has been {$verb}.");

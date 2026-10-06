<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

// Reached only via the link in the admin's password-reset-approval email.
// Same trust model as approve.php: the random 64-char token (not a login
// session) authorizes this action, and is single-use.

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
if (!password_resets_available($pdo)) {
    render_page('Password reset isn\'t set up on this server yet.');
}

$stmt = $pdo->prepare(
    "SELECT pr.id, pr.user_id, u.email, u.display_name FROM password_resets pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.admin_token IN (?, ?) AND pr.status = 'pending' AND pr.expires_at > NOW()"
);
$stmt->execute([token_hash($token), $token]);
$reset = $stmt->fetch();

if (!$reset) {
    render_page('This request was already handled, expired, or the link is invalid.');
}

if (!$isPost) {
    $who = "{$reset['display_name']} ({$reset['email']})";
    render_confirm(
        $action === 'approve' ? "Approve the password reset for {$who}? They will be emailed a link to set a new password." : "Reject the password reset request for {$who}?",
        $action === 'approve' ? 'Approve reset' : 'Reject reset',
        $token,
        $action
    );
}

if ($action === 'reject') {
    $pdo->prepare("UPDATE password_resets SET status = 'rejected' WHERE id = ?")->execute([$reset['id']]);
    render_page("Rejected. {$reset['display_name']} ({$reset['email']})'s password reset request has been rejected.");
}

// Approve: mint the user-facing token/link (separate from the admin's own
// token) and email it to the account holder -- expires in 24 hours, well
// short of the 7-day window the admin had to act on the original request.
$userToken = bin2hex(random_bytes(32));
$stmt = $pdo->prepare(
    "UPDATE password_resets SET status = 'approved', user_token = ?, approved_at = NOW(), expires_at = DATE_ADD(NOW(), INTERVAL 24 HOUR) WHERE id = ?"
);
$stmt->execute([token_hash($userToken), $reset['id']]);

$host = app_host();
$resetUrl = "https://{$host}/api/reset_password.php?token={$userToken}";
$subject = 'Fitresh: reset your password';
$body = "Hi {$reset['display_name']},\n\n"
    . "Your password reset request was approved. Set a new password here (link expires in 24 hours):\n\n"
    . "{$resetUrl}\n\n"
    . "If you didn't request this, you can ignore this email -- your password will not change unless you use this link.\n";
send_app_email($reset['email'], $subject, $body);

render_page("Approved. {$reset['display_name']} ({$reset['email']}) has been emailed a link to set a new password (expires in 24 hours).");

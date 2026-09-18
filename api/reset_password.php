<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

// Reached only via the link emailed to the account holder after an admin
// approves their reset request (see approve_reset.php). The random 64-char
// user_token is what authorizes this -- same bearer-link trust model as
// approve.php/approve_reset.php, not a login session, and it's single-use
// (status flips to 'completed' once used).

header('Content-Type: text/html; charset=utf-8');

function render_page(string $title, string $bodyHtml): void
{
    echo '<!doctype html><html><head><meta charset="utf-8"><title>Full Circle</title>'
        . '<style>body{font-family:sans-serif;max-width:420px;margin:60px auto;padding:0 16px;color:#1F2A24}'
        . 'input{width:100%;padding:10px;margin-top:6px;margin-bottom:14px;border:1px solid #ccc;border-radius:6px;font-size:15px;box-sizing:border-box;}'
        . 'label{font-size:13px;color:#555;}'
        . 'button{width:100%;padding:11px;background:#2F6F4E;color:#fff;border:none;border-radius:6px;font-size:15px;cursor:pointer;}'
        . '.err{color:#B4472A;font-size:13px;margin-bottom:10px;}</style>'
        . '</head><body><h2>Full Circle</h2><h3>' . htmlspecialchars($title) . '</h3>' . $bodyHtml . '</body></html>';
    exit;
}

$token = (string)($_GET['token'] ?? $_POST['token'] ?? '');
if ($token === '') {
    render_page('Invalid link', '<p>This reset link is missing its token.</p>');
}

$pdo = get_db();
if (!password_resets_available($pdo)) {
    render_page('Unavailable', '<p>Password reset isn\'t set up on this server yet.</p>');
}

$stmt = $pdo->prepare(
    "SELECT pr.id, pr.user_id, u.display_name FROM password_resets pr
     JOIN users u ON u.id = pr.user_id
     WHERE pr.user_token = ? AND pr.status = 'approved' AND pr.expires_at > NOW()"
);
$stmt->execute([$token]);
$reset = $stmt->fetch();

if (!$reset) {
    render_page('Link expired', '<p>This reset link was already used, has expired, or is invalid. Request a new one from the app\'s login screen.</p>');
}

if ($_SERVER['REQUEST_METHOD'] === 'POST') {
    $password = (string)($_POST['password'] ?? '');
    $confirm = (string)($_POST['password_confirm'] ?? '');
    $error = null;
    if (strlen($password) < 8) {
        $error = 'Password must be at least 8 characters.';
    } elseif ($password !== $confirm) {
        $error = 'Passwords do not match.';
    }

    if ($error !== null) {
        render_page('Set a new password', '<p class="err">' . htmlspecialchars($error) . '</p>'
            . '<form method="post"><input type="hidden" name="token" value="' . htmlspecialchars($token) . '">'
            . '<label>New password<input type="password" name="password" minlength="8" required></label>'
            . '<label>Confirm new password<input type="password" name="password_confirm" minlength="8" required></label>'
            . '<button type="submit">Set password</button></form>');
    }

    $pdo->beginTransaction();
    $hash = password_hash($password, PASSWORD_DEFAULT);
    $pdo->prepare('UPDATE users SET password_hash = ? WHERE id = ?')->execute([$hash, $reset['user_id']]);
    $pdo->prepare("UPDATE password_resets SET status = 'completed', completed_at = NOW() WHERE id = ?")->execute([$reset['id']]);
    $pdo->commit();

    render_page('Password updated', '<p>Your password has been changed. You can now log in with it in the app.</p>');
}

render_page('Set a new password', '<p>Hi ' . htmlspecialchars($reset['display_name']) . ', choose a new password below.</p>'
    . '<form method="post"><input type="hidden" name="token" value="' . htmlspecialchars($token) . '">'
    . '<label>New password<input type="password" name="password" minlength="8" required></label>'
    . '<label>Confirm new password<input type="password" name="password_confirm" minlength="8" required></label>'
    . '<button type="submit">Set password</button></form>');

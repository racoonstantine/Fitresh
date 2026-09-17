<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

header('Content-Type: application/json');
start_app_session();
require_json_request();

function send_approval_request_email(string $email, string $displayName, string $token): void
{
    $config = get_config();
    $adminEmail = $config['admin_email'] ?? null;
    if (!$adminEmail) {
        return;
    }
    // The client-supplied Host header is NOT trustworthy for building a link
    // an admin will click -- a forged Host would poison the approve/reject
    // URLs in this email, handing the approval token to an attacker's
    // domain instead of ours. Prefer a fixed, server-configured hostname;
    // only fall back to the request Host (still stripped of CR/LF) if the
    // admin hasn't set one yet.
    $host = mail_header_safe((string)($config['app_host'] ?? ($_SERVER['HTTP_HOST'] ?? '')));
    $approveUrl = "https://{$host}/api/approve.php?token={$token}&action=approve";
    $rejectUrl = "https://{$host}/api/approve.php?token={$token}&action=reject";

    $safeName = mail_header_safe($displayName);
    $subject = "Full Circle: approve signup from {$safeName}";
    $body = "New signup waiting on your approval:\n\n"
        . "Name: {$displayName}\n"
        . "Email: {$email}\n\n"
        . "Approve: {$approveUrl}\n\n"
        . "Reject: {$rejectUrl}\n";
    $headers = "From: no-reply@{$host}\r\nContent-Type: text/plain; charset=utf-8";

    @mail($adminEmail, $subject, $body, $headers);
}

// Returns an error message, or null if the username is valid and free to use by $userId.
function validate_username(PDO $pdo, string $username, int $userId): ?string
{
    if (strlen($username) < 6 || strlen($username) > 30) {
        return 'Username must be 6-30 characters.';
    }
    if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
        return 'Username can only contain letters, numbers, and underscores.';
    }
    $stmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?');
    $stmt->execute([$username, $userId]);
    if ($stmt->fetch()) {
        return 'That username is already taken.';
    }
    return null;
}

$pdo = get_db();
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

switch ($action) {
    case 'register': {
        $email = trim(strtolower((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');
        $displayName = trim((string)($input['display_name'] ?? ''));
        if ($displayName === '') {
            $displayName = explode('@', $email)[0] ?: 'friend';
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($password) < 8) {
            json_respond(['error' => 'Enter a valid email and a password of at least 8 characters.'], 400);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE email = ?');
        $stmt->execute([$email]);
        if ($stmt->fetch()) {
            json_respond(['error' => 'An account with that email already exists — log in instead.'], 409);
        }

        $hash = password_hash($password, PASSWORD_DEFAULT);
        $token = bin2hex(random_bytes(32));
        $stmt = $pdo->prepare(
            'INSERT INTO users (email, password_hash, display_name, status, approval_token, created_at)
             VALUES (?, ?, ?, ?, ?, NOW())'
        );
        $stmt->execute([$email, $hash, $displayName, 'pending', $token]);

        send_approval_request_email($email, $displayName, $token);

        json_respond([
            'pending' => true,
            'message' => "Thanks, {$displayName}! Your signup needs admin approval before you can log in — you'll be able to sign in once it's approved.",
        ]);
    }

    case 'login': {
        $email = trim(strtolower((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');

        $stmt = $pdo->prepare('SELECT id, password_hash, display_name, status, username FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_respond(['error' => 'Incorrect email or password.'], 401);
        }
        if ($user['status'] === 'pending') {
            json_respond(['error' => 'Your account is still waiting on admin approval.'], 403);
        }
        if ($user['status'] === 'rejected') {
            json_respond(['error' => 'This account was not approved.'], 403);
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];
        json_respond(['id' => (int)$user['id'], 'email' => $email, 'display_name' => $user['display_name'], 'username' => $user['username']]);
    }

    case 'logout': {
        $_SESSION = [];
        session_destroy();
        json_respond(['ok' => true]);
    }

    case 'me': {
        if (empty($_SESSION['user_id'])) {
            json_respond(['error' => 'Not logged in'], 401);
        }
        $stmt = $pdo->prepare('SELECT id, email, display_name, username FROM users WHERE id = ?');
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        if (!$user) {
            json_respond(['error' => 'Not logged in'], 401);
        }
        json_respond(['id' => (int)$user['id'], 'email' => $user['email'], 'display_name' => $user['display_name'], 'username' => $user['username']]);
    }

    case 'set_username': {
        if (empty($_SESSION['user_id'])) {
            json_respond(['error' => 'Not logged in'], 401);
        }
        $username = trim((string)($input['username'] ?? ''));
        if ($username === '') {
            json_respond(['error' => 'Username cannot be empty.'], 400);
        }
        $error = validate_username($pdo, $username, (int)$_SESSION['user_id']);
        if ($error) {
            json_respond(['error' => $error], 409);
        }

        $stmt = $pdo->prepare('UPDATE users SET username = ? WHERE id = ?');
        $stmt->execute([$username, $_SESSION['user_id']]);
        json_respond(['ok' => true, 'username' => $username]);
    }

    case 'check_username': {
        if (empty($_SESSION['user_id'])) {
            json_respond(['error' => 'Not logged in'], 401);
        }
        $username = trim((string)($_GET['username'] ?? ''));
        if ($username === '') {
            json_respond(['available' => false, 'reason' => 'Enter a username.']);
        }
        $error = validate_username($pdo, $username, (int)$_SESSION['user_id']);
        json_respond(['available' => $error === null, 'reason' => $error]);
    }

    case 'update_account': {
        if (empty($_SESSION['user_id'])) {
            json_respond(['error' => 'Not logged in'], 401);
        }
        $userId = (int)$_SESSION['user_id'];
        $displayName = trim((string)($input['display_name'] ?? ''));
        if ($displayName === '' || strlen($displayName) > 100) {
            json_respond(['error' => 'Display name must be 1-100 characters.'], 400);
        }
        $username = trim((string)($input['username'] ?? ''));
        if ($username !== '') {
            $error = validate_username($pdo, $username, $userId);
            if ($error) {
                json_respond(['error' => $error], 409);
            }
        }

        $stmt = $pdo->prepare('UPDATE users SET display_name = ?, username = ? WHERE id = ?');
        $stmt->execute([$displayName, $username !== '' ? $username : null, $userId]);
        json_respond(['ok' => true, 'display_name' => $displayName, 'username' => $username !== '' ? $username : null]);
    }

    default:
        json_respond(['error' => 'Unknown action'], 400);
}

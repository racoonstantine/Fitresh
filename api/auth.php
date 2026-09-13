<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

header('Content-Type: application/json');
start_app_session();

function send_approval_request_email(string $email, string $displayName, string $token): void
{
    $config = get_config();
    $adminEmail = $config['admin_email'] ?? null;
    if (!$adminEmail) {
        return;
    }
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $approveUrl = "https://{$host}/api/approve.php?token={$token}&action=approve";
    $rejectUrl = "https://{$host}/api/approve.php?token={$token}&action=reject";

    $subject = "Full Circle: approve signup from {$displayName}";
    $body = "New signup waiting on your approval:\n\n"
        . "Name: {$displayName}\n"
        . "Email: {$email}\n\n"
        . "Approve: {$approveUrl}\n\n"
        . "Reject: {$rejectUrl}\n";
    $headers = "From: no-reply@{$host}\r\nContent-Type: text/plain; charset=utf-8";

    @mail($adminEmail, $subject, $body, $headers);
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
        if (strlen($username) < 6 || strlen($username) > 30) {
            json_respond(['error' => 'Username must be 6-30 characters.'], 400);
        }
        if (!preg_match('/^[a-zA-Z0-9_]+$/', $username)) {
            json_respond(['error' => 'Username can only contain letters, numbers, and underscores.'], 400);
        }

        $stmt = $pdo->prepare('SELECT id FROM users WHERE LOWER(username) = LOWER(?) AND id != ?');
        $stmt->execute([$username, $_SESSION['user_id']]);
        if ($stmt->fetch()) {
            json_respond(['error' => 'That username is already taken.'], 409);
        }

        $stmt = $pdo->prepare('UPDATE users SET username = ? WHERE id = ?');
        $stmt->execute([$username, $_SESSION['user_id']]);
        json_respond(['ok' => true, 'username' => $username]);
    }

    default:
        json_respond(['error' => 'Unknown action'], 400);
}

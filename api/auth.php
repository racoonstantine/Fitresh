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
    $host = app_host();
    $approveUrl = "https://{$host}/api/approve.php?token={$token}&action=approve";
    $rejectUrl = "https://{$host}/api/approve.php?token={$token}&action=reject";

    $safeName = mail_header_safe($displayName);
    $subject = "Fitresh: approve signup from {$safeName}";
    $body = "New signup waiting on your approval:\n\n"
        . "Name: {$displayName}\n"
        . "Email: {$email}\n\n"
        . "Approve: {$approveUrl}\n\n"
        . "Reject: {$rejectUrl}\n";

    send_app_email($adminEmail, $subject, $body);
}

function send_password_reset_request_email(string $email, string $displayName, string $token): void
{
    $config = get_config();
    $adminEmail = $config['admin_email'] ?? null;
    if (!$adminEmail) {
        return;
    }
    $host = app_host();
    $approveUrl = "https://{$host}/api/approve_reset.php?token={$token}&action=approve";
    $rejectUrl = "https://{$host}/api/approve_reset.php?token={$token}&action=reject";

    $subject = "Fitresh: password reset request from " . mail_header_safe($displayName);
    $body = "A password reset was requested for this account:\n\n"
        . "Name: {$displayName}\n"
        . "Email: {$email}\n\n"
        . "Approve (emails the user a link to set a new password): {$approveUrl}\n\n"
        . "Reject: {$rejectUrl}\n\n"
        . "This request expires in 7 days if left unapproved.\n";

    send_app_email($adminEmail, $subject, $body);
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
        // Every signup emails the admin, so cap how many one address can trigger.
        rate_limit_or_429('register_ip', client_ip(), 5, 3600);
        $email = trim(strtolower((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');
        $displayName = trim((string)($input['display_name'] ?? ''));
        if ($displayName === '') {
            $displayName = explode('@', $email)[0] ?: 'friend';
        }
        if (!filter_var($email, FILTER_VALIDATE_EMAIL) || strlen($email) > 190 || strlen($password) < 8) {
            json_respond(['error' => 'Enter a valid email and a password of at least 8 characters.'], 400);
        }
        if (strlen($password) > 200) {
            json_respond(['error' => 'Password is too long (200 characters at most).'], 400);
        }
        if (mb_strlen($displayName) > 100) {
            json_respond(['error' => 'Display name must be 100 characters or fewer.'], 400);
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
        $stmt->execute([$email, $hash, $displayName, 'pending', token_hash($token)]);

        send_approval_request_email($email, $displayName, $token);

        json_respond([
            'pending' => true,
            'message' => "Thanks, {$displayName}! Your signup needs admin approval before you can log in — you'll be able to sign in once it's approved.",
        ]);
    }

    case 'login': {
        $email = trim(strtolower((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');

        // Two limits: a generous per-address one (shared networks are real) and
        // a tight per-account one on FAILED attempts, so one account can't be
        // guessed at from many addresses either.
        rate_limit_or_429('login_ip', client_ip(), 40, 900);
        if ($email !== '' && rate_limit_blocked('login_fail_email', $email, 8, 900)) {
            header('Retry-After: 900');
            json_respond(['error' => 'Too many failed attempts for this account — wait 15 minutes and try again.'], 429);
        }

        $stmt = $pdo->prepare('SELECT id, password_hash, display_name, status, username FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        // An unknown email still pays for one password check, so the response
        // time doesn't reveal which emails have accounts.
        $hashToCheck = $user ? $user['password_hash'] : '$2y$10$f6d8vdDqRnTZ5oCmpW9sQePTnLGMI7O.lXtKA7MWosL2A8jBmTBqe';
        $passwordOk = password_verify($password, $hashToCheck);
        if (!$user || !$passwordOk) {
            if ($email !== '') {
                rate_limit_record('login_fail_email', $email, 900);
            }
            json_respond(['error' => 'Incorrect email or password.'], 401);
        }
        rate_limit_clear('login_fail_email', $email);
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

    case 'request_password_reset': {
        if (!password_resets_available($pdo)) {
            json_respond(['error' => 'Password reset isn\'t set up on this server yet -- contact the admin directly.'], 503);
        }
        rate_limit_or_429('reset_ip', client_ip(), 5, 3600);
        $email = trim(strtolower((string)($input['email'] ?? '')));
        if (!filter_var($email, FILTER_VALIDATE_EMAIL)) {
            json_respond(['error' => 'Enter a valid email address.'], 400);
        }

        // The answer is the same whether or not the account exists, is approved,
        // or already has a request open -- so this form can't be used to find
        // out which emails are registered.
        $genericOk = ['ok' => true, 'message' => "If an approved account exists for that email, a password reset request has been sent for admin approval. You'll get an email with a link to set a new password once it's approved."];

        $stmt = $pdo->prepare('SELECT id, display_name, status FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || $user['status'] !== 'approved') {
            json_respond($genericOk);
        }

        // One outstanding request at a time -- stops someone from spamming
        // the admin's inbox with repeat requests for the same account.
        $stmt = $pdo->prepare(
            "SELECT id FROM password_resets WHERE user_id = ? AND status IN ('pending', 'approved') AND expires_at > NOW()"
        );
        $stmt->execute([$user['id']]);
        if ($stmt->fetch()) {
            json_respond($genericOk);
        }

        $adminToken = bin2hex(random_bytes(32));
        $stmt = $pdo->prepare(
            'INSERT INTO password_resets (user_id, admin_token, status, requested_at, expires_at)
             VALUES (?, ?, ?, NOW(), DATE_ADD(NOW(), INTERVAL 7 DAY))'
        );
        $stmt->execute([$user['id'], token_hash($adminToken), 'pending']);

        send_password_reset_request_email($email, $user['display_name'], $adminToken);

        json_respond($genericOk);
    }

    case 'logout': {
        $_SESSION = [];
        if (ini_get('session.use_cookies')) {
            $p = session_get_cookie_params();
            setcookie(session_name(), '', time() - 42000, $p['path'], $p['domain'], (bool)$p['secure'], (bool)$p['httponly']);
        }
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

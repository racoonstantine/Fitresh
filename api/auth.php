<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

header('Content-Type: application/json');
start_app_session();

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
        $stmt = $pdo->prepare('INSERT INTO users (email, password_hash, display_name, created_at) VALUES (?, ?, ?, NOW())');
        $stmt->execute([$email, $hash, $displayName]);
        $userId = (int)$pdo->lastInsertId();

        session_regenerate_id(true);
        $_SESSION['user_id'] = $userId;
        json_respond(['id' => $userId, 'email' => $email, 'display_name' => $displayName]);
    }

    case 'login': {
        $email = trim(strtolower((string)($input['email'] ?? '')));
        $password = (string)($input['password'] ?? '');

        $stmt = $pdo->prepare('SELECT id, password_hash, display_name FROM users WHERE email = ?');
        $stmt->execute([$email]);
        $user = $stmt->fetch();
        if (!$user || !password_verify($password, $user['password_hash'])) {
            json_respond(['error' => 'Incorrect email or password.'], 401);
        }

        session_regenerate_id(true);
        $_SESSION['user_id'] = (int)$user['id'];
        json_respond(['id' => (int)$user['id'], 'email' => $email, 'display_name' => $user['display_name']]);
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
        $stmt = $pdo->prepare('SELECT id, email, display_name FROM users WHERE id = ?');
        $stmt->execute([$_SESSION['user_id']]);
        $user = $stmt->fetch();
        if (!$user) {
            json_respond(['error' => 'Not logged in'], 401);
        }
        json_respond(['id' => (int)$user['id'], 'email' => $user['email'], 'display_name' => $user['display_name']]);
    }

    default:
        json_respond(['error' => 'Unknown action'], 400);
}

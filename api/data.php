<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

header('Content-Type: application/json');
start_app_session();

if (empty($_SESSION['user_id'])) {
    json_respond(['error' => 'Not logged in'], 401);
}
$userId = (int)$_SESSION['user_id'];

$ALLOWED_RESOURCES = ['nutrition', 'weighins', 'history', 'checked', 'weights', 'theme', 'profile', 'fasting', 'water', 'sleep', 'steps'];

$pdo = get_db();
$method = $_SERVER['REQUEST_METHOD'];

if ($method === 'GET') {
    $resource = (string)($_GET['resource'] ?? '');
    if (!in_array($resource, $ALLOWED_RESOURCES, true)) {
        json_respond(['error' => 'Unknown resource'], 400);
    }
    $stmt = $pdo->prepare('SELECT value FROM user_data WHERE user_id = ? AND resource_key = ?');
    $stmt->execute([$userId, $resource]);
    $row = $stmt->fetch();
    json_respond(['value' => $row ? $row['value'] : null]);
}

if ($method === 'POST') {
    $input = json_decode(file_get_contents('php://input'), true) ?? [];
    $resource = (string)($input['resource'] ?? '');
    $value = (string)($input['value'] ?? '');
    if (!in_array($resource, $ALLOWED_RESOURCES, true)) {
        json_respond(['error' => 'Unknown resource'], 400);
    }
    $stmt = $pdo->prepare(
        'INSERT INTO user_data (user_id, resource_key, value, updated_at) VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()'
    );
    $stmt->execute([$userId, $resource, $value]);
    json_respond(['ok' => true]);
}

json_respond(['error' => 'Method not allowed'], 405);

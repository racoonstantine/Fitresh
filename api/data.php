<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

header('Content-Type: application/json');
start_app_session();
require_json_request();

if (empty($_SESSION['user_id'])) {
    json_respond(['error' => 'Not logged in'], 401);
}
$userId = (int)$_SESSION['user_id'];

$ALLOWED_RESOURCES = ['nutrition', 'weighins', 'history', 'checked', 'weights', 'theme', 'profile', 'fasting', 'water', 'sleep', 'steps', 'recentFoods', 'favoriteFoods', 'workoutPlan', 'trainingPlan', 'customWorkoutPlans', 'sharing'];

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
    // Cap the read like the other endpoints do, so a bloated body can't tie
    // up the request indefinitely or bypass what a legitimate resource
    // payload should ever need.
    $raw = file_get_contents('php://input', false, null, 0, 8388609);
    if (strlen($raw) > 8388608) {
        json_respond(['error' => 'Request too large'], 413);
    }
    $input = json_decode($raw, true) ?? [];
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

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
    $stmt = $pdo->prepare('SELECT value, updated_at FROM user_data WHERE user_id = ? AND resource_key = ?');
    $stmt->execute([$userId, $resource]);
    $row = $stmt->fetch();
    // updated_at is the version stamp clients send back as base_updated_at.
    json_respond(['value' => $row ? $row['value'] : null, 'updated_at' => $row ? $row['updated_at'] : null]);
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
    // One account can't use the table as free file storage: cap everything a
    // user has stored (the value being replaced doesn't count against it).
    $stmt = $pdo->prepare('SELECT COALESCE(SUM(LENGTH(value)), 0) FROM user_data WHERE user_id = ? AND resource_key <> ?');
    $stmt->execute([$userId, $resource]);
    if ((int)$stmt->fetchColumn() + strlen($value) > 33554432) {
        json_respond(['error' => 'Storage limit reached for this account.'], 413);
    }
    // Optimistic concurrency. The whole resource is one JSON blob that the
    // client rewrites in full, so a device holding an old copy would silently
    // wipe out edits made on another device. A client that sends
    // base_updated_at (the stamp it last read or wrote; 'none' = "I believe
    // nothing is stored yet") only overwrites if that is still the current
    // stamp -- otherwise it gets 409 plus the current value to reconcile.
    // Omitting base_updated_at is a deliberate overwrite.
    $hasBase = array_key_exists('base_updated_at', $input);
    $base = $hasBase ? (string)$input['base_updated_at'] : null;

    $pdo->beginTransaction();
    $stmt = $pdo->prepare('SELECT value, updated_at FROM user_data WHERE user_id = ? AND resource_key = ? FOR UPDATE');
    $stmt->execute([$userId, $resource]);
    $current = $stmt->fetch();
    if ($hasBase) {
        $currentStamp = $current ? (string)$current['updated_at'] : 'none';
        if ($currentStamp !== $base) {
            $pdo->rollBack();
            json_respond([
                'error' => 'conflict',
                'value' => $current ? $current['value'] : null,
                'updated_at' => $current ? $current['updated_at'] : null,
            ], 409);
        }
    }
    $stmt = $pdo->prepare(
        'INSERT INTO user_data (user_id, resource_key, value, updated_at) VALUES (?, ?, ?, NOW())
         ON DUPLICATE KEY UPDATE value = VALUES(value), updated_at = NOW()'
    );
    $stmt->execute([$userId, $resource, $value]);
    $stmt = $pdo->prepare('SELECT updated_at FROM user_data WHERE user_id = ? AND resource_key = ?');
    $stmt->execute([$userId, $resource]);
    $stamp = $stmt->fetchColumn();
    $pdo->commit();
    json_respond(['ok' => true, 'updated_at' => $stamp ?: null]);
}

json_respond(['error' => 'Method not allowed'], 405);

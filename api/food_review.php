<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/admin_guard.php';
require __DIR__ . '/food_review_lib.php';

header('Content-Type: application/json');
start_app_session();
require_json_request();

$pdo = get_db();
require_admin_user($pdo);

$method = $_SERVER['REQUEST_METHOD'];
$input = $method === 'POST' ? (json_decode(file_get_contents('php://input'), true) ?? []) : [];
$action = $method === 'GET' ? (string)($_GET['action'] ?? '') : (string)($input['action'] ?? '');

if ($method === 'GET' && $action === 'candidates') {
    if (!food_review_available($pdo)) {
        json_respond(['available' => false, 'min_users' => FOOD_REVIEW_MIN_USERS, 'candidates' => []]);
    }
    $minUsers = max(2, min(20, (int)($_GET['min_users'] ?? FOOD_REVIEW_MIN_USERS)));
    json_respond([
        'available' => true,
        'min_users' => $minUsers,
        'opted_in' => count(food_review_opted_in_users($pdo)),
        'candidates' => food_review_candidates($pdo, $minUsers),
    ]);
}

if ($method === 'POST' && $action === 'decide') {
    if (!food_review_available($pdo)) {
        json_respond(['error' => 'Food review is awaiting database setup (migration 007).'], 503);
    }
    $key = trim((string)($input['norm_key'] ?? ''));
    $unit = (string)($input['unit_kind'] ?? '');
    $decision = (string)($input['decision'] ?? '');
    if ($key === '' || strlen($key) > 190 || !in_array($unit, ['g', 'ml', 'serving'], true) || !in_array($decision, ['reviewed', 'dismissed'], true)) {
        json_respond(['error' => 'Invalid request'], 400);
    }
    food_review_record($pdo, $key, $unit, $decision);
    json_respond(['ok' => true]);
}

json_respond(['error' => 'Unknown action'], 400);

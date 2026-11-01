<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require_once __DIR__ . '/meal_photo_lib.php';

start_app_session();
if (empty($_SESSION['user_id'])) {
    json_respond(['error' => 'Not logged in'], 401);
}
$userId = (int)$_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];

// GET ?id=<meal entry id> -> the thumbnail itself. Only the owner can read it, only for 7 days, and it is
// marked private so Cloudflare and other shared caches never keep a copy.
if ($method === 'GET') {
    session_write_close(); // a read; don't make parallel image loads queue on the session lock
    $entryId = (int)($_GET['id'] ?? 0);
    try {
        $photo = $entryId > 0 ? meal_photo_fetch(get_db(), $userId, $entryId) : null;
    } catch (PDOException $e) {
        $photo = null; // migration 009 not applied yet
    }
    if ($photo === null) {
        json_respond(['error' => 'No photo'], 404);
    }
    header('Content-Type: ' . $photo[0]);
    header('Cache-Control: private, max-age=3600');
    header('X-Content-Type-Options: nosniff');
    header('Content-Length: ' . strlen($photo[1]));
    echo $photo[1];
    exit;
}

if ($method !== 'POST') {
    json_respond(['error' => 'Method not allowed'], 405);
}
require_json_request();
$raw = file_get_contents('php://input', false, null, 0, 400001);
if (strlen($raw) > 400000) {
    json_respond(['error' => 'Request too large'], 413);
}
$input = json_decode($raw, true) ?? [];
$entryId = (int)($input['meal_entry_id'] ?? 0);
try {
    [$mime, $bytes] = meal_photo_validate($input['image'] ?? null);
} catch (InvalidArgumentException $e) {
    json_respond(['error' => $e->getMessage()], 400);
}
$summary = meal_photo_clean_text($input['summary'] ?? '', 300);
$confidence = meal_photo_clean_text($input['confidence'] ?? '', 10);
if ($confidence !== null && !in_array($confidence, ['High', 'Medium', 'Low'], true)) {
    $confidence = null;
}
try {
    $stored = $entryId > 0 && meal_photo_store(get_db(), $userId, $entryId, $mime, $bytes, $summary, $confidence);
} catch (PDOException $e) {
    error_log('meal_photo: ' . $e->getMessage());
    json_respond(['error' => 'Photos are not available yet.'], 503);
}
if (!$stored) {
    json_respond(['error' => 'Meal not found.'], 404);
}
json_respond(['ok' => true]);

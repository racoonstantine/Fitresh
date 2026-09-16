<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require_once __DIR__ . '/catalog.php';
header('Content-Type: application/json');
start_app_session();
if (empty($_SESSION['user_id'])) json_respond(['error'=>'Not logged in'],401);
try {
    json_respond(catalog_search((string)($_GET['q'] ?? '')));
} catch (Throwable $e) {
    error_log('Food catalog search: ' . $e->getMessage());
    json_respond(['results'=>[],'suggestions'=>[],'error'=>'Local food search is temporarily unavailable.'],503);
}

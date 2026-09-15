<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

header('Content-Type: application/json');
start_app_session();

if (empty($_SESSION['user_id'])) {
    json_respond(['error' => 'Not logged in'], 401);
}
if ($_SERVER['REQUEST_METHOD'] !== 'POST') {
    json_respond(['error' => 'Method not allowed'], 405);
}

$pdo = get_db();
$stmt = $pdo->prepare('SELECT email, display_name FROM users WHERE id = ?');
$stmt->execute([$_SESSION['user_id']]);
$user = $stmt->fetch();
if (!$user) {
    json_respond(['error' => 'Not logged in'], 401);
}

$input = json_decode(file_get_contents('php://input'), true) ?? [];
$category = (string)($input['category'] ?? 'idea');
if (!in_array($category, ['idea', 'problem', 'data'], true)) {
    $category = 'idea';
}
$message = trim((string)($input['message'] ?? ''));
if ($message === '') {
    json_respond(['error' => 'Enter a message before sending.'], 400);
}
if (strlen($message) > 4000) {
    $message = substr($message, 0, 4000);
}

$config = get_config();
$adminEmail = $config['admin_email'] ?? null;
if ($adminEmail) {
    $host = $_SERVER['HTTP_HOST'] ?? '';
    $labels = ['idea' => 'An idea', 'problem' => 'A problem', 'data' => 'Data looks wrong'];
    $subject = "Full Circle feedback ({$labels[$category]}) from {$user['display_name']}";
    $body = "From: {$user['display_name']} <{$user['email']}>\n"
        . "Category: {$labels[$category]}\n\n"
        . $message . "\n";
    $headers = "From: no-reply@{$host}\r\nContent-Type: text/plain; charset=utf-8";
    @mail($adminEmail, $subject, $body, $headers);
}

json_respond(['ok' => true]);

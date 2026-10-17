<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/ai_assist_lib.php';

// Native AI Assist: the app's own prompt goes to OpenAI and the reply comes straight back, so users
// skip the copy/paste round trip. Needs 'openai_api_key' in api/config.local.php; without it
// GET reports {enabled:false} and the app keeps showing the copy/paste flow only.
// Optional config: 'openai_model' (default gpt-4o-mini), 'ai_daily_limit' per user (default 40),
// 'ai_global_daily_limit' for the whole site (default 600). Photos are never stored.

header('Content-Type: application/json');
start_app_session();
require_json_request();

if (empty($_SESSION['user_id'])) {
    json_respond(['error' => 'Not logged in'], 401);
}

$config = get_config();
$apiKey = (string)($config['openai_api_key'] ?? '');
$method = $_SERVER['REQUEST_METHOD'] ?? '';

if ($method === 'GET') {
    json_respond(['enabled' => $apiKey !== '']);
}
if ($method !== 'POST') {
    json_respond(['error' => 'Method not allowed'], 405);
}
if ($apiKey === '') {
    json_respond(['error' => 'AI is not switched on for this site yet.', 'code' => 'unavailable'], 503);
}

try {
    [$prompt, $image] = ai_validate_request(json_decode(file_get_contents('php://input'), true) ?? []);
} catch (InvalidArgumentException $e) {
    json_respond(['error' => $e->getMessage()], 400);
}

$userId = (string)$_SESSION['user_id'];
$perUser = max(1, (int)($config['ai_daily_limit'] ?? 40));
$global = max(1, (int)($config['ai_global_daily_limit'] ?? 600));
if (rate_limit_blocked('ai_user', $userId, $perUser, 86400)) {
    json_respond(['error' => "You've used today's AI estimates. Copy and paste still works, or try again tomorrow.", 'code' => 'daily_limit'], 429);
}
if (rate_limit_blocked('ai_global', 'all', $global, 86400)) {
    json_respond(['error' => 'AI estimates are busy right now. Copy and paste still works, or try again tomorrow.', 'code' => 'daily_limit'], 429);
}
rate_limit_or_429('ai_burst', $userId, 6, 60);

$body = ai_build_openai_body($prompt, $image, (string)($config['openai_model'] ?? 'gpt-4o-mini'));
[$status, $response] = ai_openai_transport($apiKey, $body, (string)($config['openai_base_url'] ?? 'https://api.openai.com/v1'));
unset($image, $body);

if ($status !== 200 || !is_array($response)) {
    error_log('ai_assist: OpenAI status ' . $status);
    json_respond(['error' => 'The AI did not answer. Try again, or use copy and paste.'], 502);
}
$reply = ai_extract_reply($response);
if ($reply === null) {
    json_respond(['error' => 'The AI sent back an empty answer. Try again.'], 502);
}
// Count only answered requests, so a provider outage doesn't burn anyone's daily allowance.
rate_limit_record('ai_user', $userId, 86400);
rate_limit_record('ai_global', 'all', 86400);
json_respond(['reply' => $reply]);

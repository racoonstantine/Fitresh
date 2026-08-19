<?php
$configPath = __DIR__ . '/config.local.php';
if (!is_file($configPath)) {
    http_response_code(500);
    header('Content-Type: application/json');
    echo json_encode(['error' => 'Server not configured: copy api/config.example.php to api/config.local.php on the server and fill in your DB credentials.']);
    exit;
}
return require $configPath;

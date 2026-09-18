<?php
declare(strict_types=1);

function get_config(): array
{
    static $config = null;
    if ($config === null) {
        $config = require __DIR__ . '/config.php';
    }
    return $config;
}

function get_db(): PDO
{
    static $pdo = null;
    if ($pdo === null) {
        $config = get_config();
        $dsn = "mysql:host={$config['db_host']};dbname={$config['db_name']};charset=utf8mb4";
        $pdo = new PDO($dsn, $config['db_user'], $config['db_pass'], [
            PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION,
            PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC,
        ]);
    }
    return $pdo;
}

function start_app_session(): void
{
    if (session_status() === PHP_SESSION_ACTIVE) {
        return;
    }
    session_set_cookie_params([
        'lifetime' => 60 * 60 * 24 * 30,
        'path' => '/',
        'secure' => !empty($_SERVER['HTTPS']),
        'httponly' => true,
        'samesite' => 'Lax',
    ]);
    session_start();
}

function json_respond(array $data, int $code = 200)
{
    http_response_code($code);
    header('Content-Type: application/json');
    echo json_encode($data);
    exit;
}

// Cheap but real CSRF mitigation for our session-cookie-authenticated JSON
// API: a cross-site <form> (the classic CSRF vector) cannot set an
// application/json Content-Type without JavaScript, and a cross-origin
// fetch/XHR that tries to fake one triggers a CORS preflight this server
// never answers with permissive headers -- so it never reaches here. Call
// this at the top of every state-changing POST action, right after
// start_app_session(). GET requests are unaffected (nothing state-changing
// should ever happen on GET anyway).
function require_json_request(): void
{
    if (($_SERVER['REQUEST_METHOD'] ?? '') !== 'POST') {
        return;
    }
    // Some SAPI/webserver combinations (PHP-FPM behind certain proxies, in
    // particular) only populate HTTP_CONTENT_TYPE, not CONTENT_TYPE -- check
    // both so a legitimate request never gets rejected over which key the
    // header landed in.
    $contentType = $_SERVER['CONTENT_TYPE'] ?? $_SERVER['HTTP_CONTENT_TYPE'] ?? '';
    if (stripos($contentType, 'application/json') !== 0) {
        json_respond(['error' => 'JSON required'], 415);
    }
}

// Strips characters that could inject extra headers or lines into an email
// built by hand for PHP's mail() -- CWE-93. Apply to anything
// attacker-influenced (display name, request Host, etc.) before it goes
// into a header or a Subject line.
function mail_header_safe(string $value): string
{
    return trim(str_replace(["\r", "\n"], '', $value));
}

// The server-configured hostname for building links in outgoing emails
// (approve/reject, password reset). Deliberately NOT the request's Host
// header -- that's client-supplied and a forged one would poison the link
// with an attacker's domain instead of ours.
function app_host(): string
{
    $config = get_config();
    return mail_header_safe((string)($config['app_host'] ?? ($_SERVER['HTTP_HOST'] ?? '')));
}

// Thin wrapper around mail() so every outgoing email (signup approval,
// password reset) builds its From header the same way and via the same
// server-configured host.
function send_app_email(string $to, string $subject, string $body): void
{
    $host = app_host();
    $headers = "From: no-reply@{$host}\r\nContent-Type: text/plain; charset=utf-8";
    @mail($to, mail_header_safe($subject), $body, $headers);
}

// Same "hasn't been migrated on this server yet" guard used elsewhere
// (personal_foods_available) -- lets self-service password reset degrade
// to a clear error instead of a fatal SQL error if migration 006 hasn't
// been applied yet.
function password_resets_available(PDO $pdo): bool
{
    try {
        $pdo->query('SELECT id FROM password_resets LIMIT 0');
        return true;
    } catch (PDOException $e) {
        if ($e->getCode() === '42S02' || str_contains($e->getMessage(), 'no such table')) {
            return false;
        }
        throw $e;
    }
}

// GETs a URL server-side for calling external food-data APIs (Open Food
// Facts, and USDA later). Prefers curl -- some PHP builds have curl but not
// the openssl stream wrapper file_get_contents needs for https://, which
// otherwise fails with a misleading "No such file or directory". Falls back
// to file_get_contents so this still works wherever curl isn't available.
function http_get_with_fallback(string $url, int $timeoutSeconds = 8)
{
    if (function_exists('curl_init')) {
        $ch = curl_init($url);
        curl_setopt_array($ch, [
            CURLOPT_RETURNTRANSFER => true,
            CURLOPT_TIMEOUT => $timeoutSeconds,
            CURLOPT_USERAGENT => 'FullCircleHealth/1.0 (contact via app)',
            CURLOPT_FOLLOWLOCATION => true,
            // Some providers gzip-compress the response even without an explicit
            // Accept-Encoding request; empty string = "advertise and auto-decode
            // whatever curl supports" so we don't get raw compressed bytes back.
            CURLOPT_ENCODING => '',
        ]);
        $body = curl_exec($ch);
        $ok = $body !== false && curl_errno($ch) === 0;
        curl_close($ch);
        if ($ok) {
            return $body;
        }
    }

    $context = stream_context_create(['http' => [
        'timeout' => $timeoutSeconds,
        'header' => "User-Agent: FullCircleHealth/1.0 (contact via app)\r\n",
    ]]);
    return @file_get_contents($url, false, $context);
}

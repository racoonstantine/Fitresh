<?php
declare(strict_types=1);

// Small, dependency-free security helpers shared by every endpoint (required
// from db.php): response headers, file-based rate limiting, token hashing.

// Headers that are safe for every response (JSON and the few HTML pages).
// A Content-Security-Policy is intentionally not set here: the app relies on
// inline scripts and styles, so a policy strict enough to matter would break it.
function send_security_headers(): void
{
    if (PHP_SAPI === 'cli' || headers_sent()) {
        return;
    }
    header('X-Content-Type-Options: nosniff');
    header('X-Frame-Options: SAMEORIGIN');
    header('Referrer-Policy: strict-origin-when-cross-origin');
    header('Permissions-Policy: camera=(), microphone=(), geolocation=()');
}

// ---------- Rate limiting ----------
// Counters live in small JSON files under the system temp directory, so this
// needs no database migration. Each file holds the timestamps of recent
// events for one (bucket, key) pair. If the temp directory can't be used the
// functions fail open -- a broken limiter must never lock real users out.

// Cloudflare's published proxy ranges, fetched 2026-10-31 from
// https://www.cloudflare.com/ips-v4 and /ips-v6. They change rarely; re-fetch
// from those URLs occasionally and update this list.
const CLOUDFLARE_RANGES = [
    '173.245.48.0/20', '103.21.244.0/22', '103.22.200.0/22', '103.31.4.0/22',
    '141.101.64.0/18', '108.162.192.0/18', '190.93.240.0/20', '188.114.96.0/20',
    '197.234.240.0/22', '198.41.128.0/17', '162.158.0.0/15', '104.16.0.0/13',
    '104.24.0.0/14', '172.64.0.0/13', '131.0.72.0/22',
    '2400:cb00::/32', '2606:4700::/32', '2803:f800::/32', '2405:b500::/32',
    '2405:8100::/32', '2a06:98c0::/29', '2c0f:f248::/32',
];

// True if $ip (IPv4 or IPv6) falls inside $cidr. Mixed families never match.
function ip_in_cidr(string $ip, string $cidr): bool
{
    $parts = explode('/', $cidr, 2);
    $addr = @inet_pton($ip);
    $net = @inet_pton($parts[0]);
    if ($addr === false || $net === false || strlen($addr) !== strlen($net) || !isset($parts[1])) {
        return false;
    }
    $bits = (int)$parts[1];
    $bytes = intdiv($bits, 8);
    if ($bytes > 0 && substr($addr, 0, $bytes) !== substr($net, 0, $bytes)) {
        return false;
    }
    $rest = $bits % 8;
    if ($rest === 0) {
        return true;
    }
    $mask = (0xFF << (8 - $rest)) & 0xFF;
    return (ord($addr[$bytes]) & $mask) === (ord($net[$bytes]) & $mask);
}

function is_cloudflare_ip(string $ip): bool
{
    foreach (CLOUDFLARE_RANGES as $cidr) {
        if (ip_in_cidr($ip, $cidr)) {
            return true;
        }
    }
    return false;
}

function client_ip(): string
{
    $remote = (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
    // Behind Cloudflare, REMOTE_ADDR is a shared edge IP, so the real visitor
    // is in CF-Connecting-IP. That header is client-supplied, so it is trusted
    // only when the connection really comes from a Cloudflare range; anything
    // else (or a value that isn't an IP) falls back to REMOTE_ADDR.
    // X-Forwarded-For is never used: it would let an attacker pick a fresh
    // "identity" on every request.
    $header = $_SERVER['HTTP_CF_CONNECTING_IP'] ?? null;
    if (is_string($header) && is_cloudflare_ip($remote)) {
        $header = trim($header);
        if (filter_var($header, FILTER_VALIDATE_IP) !== false) {
            return $header;
        }
    }
    return $remote;
}

function rate_limit_path(string $bucket, string $key): ?string
{
    // FITRESH_RL_DIR lets tests use a private directory instead of the shared temp dir.
    $dir = getenv('FITRESH_RL_DIR') ?: (sys_get_temp_dir() . DIRECTORY_SEPARATOR . 'fitresh_rl');
    if (!is_dir($dir) && !@mkdir($dir, 0700, true) && !is_dir($dir)) {
        return null;
    }
    return $dir . DIRECTORY_SEPARATOR . sha1($bucket . '|' . $key) . '.json';
}

// Runs $fn(array $timestamps): array under an exclusive lock and stores the
// returned (pruned) list. Returns whatever $fn last saw, or null on I/O trouble.
function rate_limit_with(string $bucket, string $key, int $windowSec, callable $fn): ?array
{
    $path = rate_limit_path($bucket, $key);
    if ($path === null) {
        return null;
    }
    $fh = @fopen($path, 'c+');
    if (!$fh) {
        return null;
    }
    try {
        if (!flock($fh, LOCK_EX)) {
            return null;
        }
        $raw = stream_get_contents($fh);
        $times = $raw ? (json_decode($raw, true) ?: []) : [];
        $cutoff = time() - $windowSec;
        $times = array_values(array_filter($times, fn($t) => is_int($t) && $t > $cutoff));
        $times = $fn($times);
        ftruncate($fh, 0);
        rewind($fh);
        fwrite($fh, json_encode($times));
        fflush($fh);
        flock($fh, LOCK_UN);
        return $times;
    } finally {
        fclose($fh);
    }
}

// True once $max events have been recorded inside the window. Does not record.
function rate_limit_blocked(string $bucket, string $key, int $max, int $windowSec): bool
{
    $times = rate_limit_with($bucket, $key, $windowSec, fn($t) => $t);
    return $times !== null && count($times) >= $max;
}

function rate_limit_record(string $bucket, string $key, int $windowSec): void
{
    rate_limit_with($bucket, $key, $windowSec, function ($t) {
        $t[] = time();
        return $t;
    });
}

function rate_limit_clear(string $bucket, string $key): void
{
    $path = rate_limit_path($bucket, $key);
    if ($path !== null && is_file($path)) {
        @unlink($path);
    }
}

// Records one event and answers 429 if that pushes the caller over the limit.
function rate_limit_or_429(string $bucket, string $key, int $max, int $windowSec): void
{
    if (rate_limit_blocked($bucket, $key, $max, $windowSec)) {
        header('Retry-After: ' . $windowSec);
        json_respond(['error' => 'Too many attempts — please wait a while and try again.'], 429);
    }
    rate_limit_record($bucket, $key, $windowSec);
}

// ---------- Token hashing ----------
// Approval / reset tokens are emailed raw but only their SHA-256 is stored, so
// a database leak can't be turned into working approval or reset links.
// Lookups also accept the raw value so tokens issued before this change (still
// stored in plain text) keep working until they're used or expire.
function token_hash(string $token): string
{
    return hash('sha256', $token);
}

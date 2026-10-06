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

function client_ip(): string
{
    // REMOTE_ADDR only: X-Forwarded-For is client-supplied and would let an
    // attacker pick a fresh "identity" on every request.
    return (string)($_SERVER['REMOTE_ADDR'] ?? 'unknown');
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

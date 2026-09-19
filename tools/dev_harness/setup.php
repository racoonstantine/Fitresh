<?php
declare(strict_types=1);
// Builds a throwaway copy of the backend in <tmpDir>: api/*.php with get_db()
// swapped for SQLite, a fresh SQLite DB built from db/schema.sql +
// db/migrations/*.sql + db/workout_seed.sql, and seeded fixture users/data.
// Usage: php setup.php <repoRoot> <tmpDir>
// Never touches the repo's real api/config.local.php.

require __DIR__ . '/sqlite_pdo.php';
require __DIR__ . '/fixtures.php';

[, $repo, $tmp] = $argv + [null, null, null];
if (!$repo || !$tmp) {
    fwrite(STDERR, "usage: php setup.php <repoRoot> <tmpDir>\n");
    exit(2);
}
$repo = rtrim(str_replace('\\', '/', $repo), '/');
$tmp = rtrim(str_replace('\\', '/', $tmp), '/');
@mkdir("$tmp/api/catalog-history", 0777, true);

// ---- api copy -------------------------------------------------------------
foreach (glob("$repo/api/*.php") as $f) {
    $name = basename($f);
    if ($name === 'config.php' || $name === 'config.local.php') {
        continue; // config.php is replaced below
    }
    copy($f, "$tmp/api/$name");
}
copy("$repo/api/catalog-active.json", "$tmp/api/catalog-active.json");
$active = json_decode((string)file_get_contents("$repo/api/catalog-active.json"), true)['version'];
copy("$repo/api/catalog-history/$active.json", "$tmp/api/catalog-history/$active.json");
copy(__DIR__ . '/sqlite_pdo.php', "$tmp/api/harness_sqlite_pdo.php");

// Swap get_db() (MySQL) for the SQLite one; everything else in db.php stays real.
$db = (string)file_get_contents("$tmp/api/db.php");
$start = strpos($db, 'function get_db(): PDO');
$end = strpos($db, 'function start_app_session');
if ($start === false || $end === false || $end < $start) {
    fwrite(STDERR, "setup: could not locate get_db() in api/db.php -- update tools/dev_harness/setup.php\n");
    exit(1);
}
$replacement = "require_once __DIR__ . '/harness_sqlite_pdo.php';\n"
    . "function get_db(): PDO\n{\n    static \$pdo = null;\n    if (\$pdo === null) {\n        \$pdo = harness_open(get_config()['sqlite_path']);\n    }\n    return \$pdo;\n}\n\n";
file_put_contents("$tmp/api/db.php", substr($db, 0, $start) . $replacement . substr($db, $end));

// admin_guard.php hardcodes the owner's email; point the copy at the harness admin.
$adminSrc = (string)file_get_contents("$tmp/api/admin_guard.php");
$patched = preg_replace('/const ADMIN_EMAILS = \[[^\]]*\];/', "const ADMIN_EMAILS = ['admin@example.com'];", $adminSrc, 1, $n);
if ($n !== 1) {
    fwrite(STDERR, "setup: could not patch ADMIN_EMAILS in api/admin_guard.php -- update tools/dev_harness/setup.php\n");
    exit(1);
}
file_put_contents("$tmp/api/admin_guard.php", $patched);

$dbFile = "$tmp/harness.sqlite";
$config = [
    'sqlite_path' => $dbFile,
    'admin_email' => 'admin@example.com',
    'app_host' => '127.0.0.1',
];
file_put_contents("$tmp/api/config.php", '<?php return ' . var_export($config, true) . ";\n");

// ---- schema ---------------------------------------------------------------
$pdo = harness_open($dbFile);
$scripts = array_merge([$repo . '/db/schema.sql'], glob($repo . '/db/migrations/*.sql'), [$repo . '/db/workout_seed.sql']);
foreach ($scripts as $file) {
    foreach (harness_split_sql((string)file_get_contents($file)) as $stmt) {
        foreach (harness_ddl($stmt) as $sql) {
            try {
                $pdo->exec($sql);
            } catch (Throwable $e) {
                // schema.sql may already include a column a migration adds.
                if (str_contains($e->getMessage(), 'duplicate column name')) continue;
                fwrite(STDERR, 'setup: ' . basename($file) . ': ' . $e->getMessage() . "\n  " . substr($sql, 0, 160) . "\n");
                exit(1);
            }
        }
    }
}

// ---- users + fixture data -------------------------------------------------
$password = 'testpass123';
$addUser = $pdo->prepare("INSERT INTO users (email, password_hash, display_name, status, created_at, username) VALUES (?,?,?,?,datetime('now'),?)");
$addUser->execute(['tester@example.com', password_hash($password, PASSWORD_DEFAULT), 'Test User', 'approved', 'tester']);
$addUser->execute(['other@example.com', password_hash($password, PASSWORD_DEFAULT), 'Other User', 'approved', 'other']);
$addUser->execute(['admin@example.com', password_hash($password, PASSWORD_DEFAULT), 'Admin', 'approved', 'admin']);
$testerId = (int)$pdo->query("SELECT id FROM users WHERE email='tester@example.com'")->fetchColumn();
$adminId = (int)$pdo->query("SELECT id FROM users WHERE email='admin@example.com'")->fetchColumn();

$put = $pdo->prepare("INSERT INTO user_data (user_id, resource_key, value, updated_at) VALUES (?,?,?,datetime('now'))");
foreach (harness_fixture(date('Y-m-d')) as $key => $value) {
    $put->execute([$testerId, $key, json_encode($value)]);
}
// Admin + other users start empty (fresh-account / onboarding paths).
echo json_encode(['db' => $dbFile, 'password' => $password, 'catalogVersion' => $active, 'testerId' => $testerId, 'adminId' => $adminId]) . "\n";

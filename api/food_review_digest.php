<?php
declare(strict_types=1);
// Twice-monthly food-review digest for the admin. Run from cron (CLI only):
//   php /path/to/api/food_review_digest.php            # emails new candidates, marks them "sent"
//   php /path/to/api/food_review_digest.php --dry-run  # prints the digest, sends and records nothing
// See docs/food-review.md for the cPanel cron line.
if (PHP_SAPI !== 'cli') {
    http_response_code(403);
    exit("CLI only\n");
}
require __DIR__ . '/db.php';
require __DIR__ . '/food_review_lib.php';

$dryRun = in_array('--dry-run', $argv ?? [], true);
$pdo = get_db();
if (!food_review_available($pdo)) {
    fwrite(STDERR, "food_review_log table missing -- run db/migrations/007_food_review.sql first.\n");
    exit(1);
}
$new = array_values(array_filter(food_review_candidates($pdo), fn($c) => $c['status'] === 'new'));
if (!$new) {
    echo "No new candidates.\n";
    exit(0);
}
$body = food_review_digest_text($new);
if ($dryRun) {
    echo $body . "\n";
    exit(0);
}
$to = (string)(get_config()['admin_email'] ?? '');
if ($to === '') {
    fwrite(STDERR, "admin_email is not set in config.local.php\n");
    exit(1);
}
send_app_email($to, 'Food review: ' . count($new) . ' shared food' . (count($new) === 1 ? '' : 's') . ' to check', $body);
foreach ($new as $c) {
    food_review_record($pdo, $c['key'], $c['unit_kind'], 'sent', $c['users']);
}
echo 'Sent ' . count($new) . " candidate(s) to $to.\n";

<?php
declare(strict_types=1);
require __DIR__ . '/../api/meal_photo_lib.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function rejects(callable $f, string $message): void { try { $f(); } catch (InvalidArgumentException $e) { return; } throw new RuntimeException($message); }

// ---- validation ----
$webp = 'RIFF' . pack('V', 20) . 'WEBP' . str_repeat('x', 20);
$jpeg = "\xFF\xD8\xFF\xE0" . str_repeat('x', 20);
[$mime, $bytes] = meal_photo_validate('data:image/webp;base64,' . base64_encode($webp));
check($mime === 'image/webp' && $bytes === $webp, 'valid WebP accepted');
[$mime] = meal_photo_validate('data:image/jpeg;base64,' . base64_encode($jpeg));
check($mime === 'image/jpeg', 'valid JPEG accepted');
rejects(fn() => meal_photo_validate('data:image/png;base64,' . base64_encode($webp)), 'PNG label refused');
rejects(fn() => meal_photo_validate('data:image/webp;base64,' . base64_encode($jpeg)), 'JPEG bytes labelled WebP refused');
rejects(fn() => meal_photo_validate('data:image/jpeg;base64,' . base64_encode($webp)), 'WebP bytes labelled JPEG refused');
rejects(fn() => meal_photo_validate('data:image/webp;base64,' . base64_encode('RIFF' . pack('V', 0) . 'WEBP' . str_repeat('x', MEAL_PHOTO_MAX_BYTES))), 'oversize refused');
rejects(fn() => meal_photo_validate('data:image/webp;base64,@@@'), 'not base64 refused');
rejects(fn() => meal_photo_validate(['x']), 'non-string refused');
rejects(fn() => meal_photo_validate(null), 'missing refused');
check(meal_photo_clean_text("  a\nb\x00c  ", 10) === 'a b c', 'control characters become spaces');
check(meal_photo_clean_text(str_repeat('é', 500), 300) === str_repeat('é', 300), 'text is cut to the limit by characters');
check(meal_photo_clean_text('   ', 10) === null, 'blank text is null');

// ---- storage rules ----
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec('CREATE TABLE meal_entries (id INTEGER PRIMARY KEY AUTOINCREMENT, user_id INTEGER NOT NULL, entry_date TEXT, meal_type TEXT, display_name TEXT, created_at TEXT)');
$pdo->exec('CREATE TABLE meal_photos (meal_entry_id INTEGER PRIMARY KEY, user_id INTEGER NOT NULL, mime TEXT, image BLOB, summary TEXT, confidence TEXT, created_at TEXT NOT NULL)');
$entry = function (int $user) use ($pdo): int {
    $pdo->prepare("INSERT INTO meal_entries (user_id, entry_date, meal_type, created_at) VALUES (?, '2026-11-01', 'lunch', '2026-11-01 12:00:00')")->execute([$user]);
    return (int)$pdo->lastInsertId();
};
$day = 86400;
$t0 = 1793500000;

$mine = $entry(1);
$theirs = $entry(2);
check(meal_photo_store($pdo, 1, $mine, 'image/webp', $webp, 'Crab and prawns', 'High', $t0), 'owner can save a photo');
check(!meal_photo_store($pdo, 1, $theirs, 'image/webp', $webp, null, null, $t0), "someone else's meal is refused");
check(!meal_photo_store($pdo, 1, 9999, 'image/webp', $webp, null, null, $t0), 'unknown meal is refused');
check(meal_photo_fetch($pdo, 2, $mine, $t0) === null, "another user cannot read the photo");
check(meal_photo_fetch($pdo, 1, $mine, $t0 + $day)[1] === $webp, 'owner reads it back byte for byte');

// info for the day view carries no image bytes
$info = meal_photo_info($pdo, 1, [$mine, $theirs], $t0 + $day);
check(count($info) === 1 && $info[$mine]['has_photo'] === true && $info[$mine]['summary'] === 'Crab and prawns' && $info[$mine]['confidence'] === 'High', 'day info');
check(meal_photo_info($pdo, 1, [], $t0) === [], 'no entries, no info');

// a new save replaces the old one
meal_photo_store($pdo, 1, $mine, 'image/jpeg', $jpeg, 'New', null, $t0 + $day);
check(meal_photo_fetch($pdo, 1, $mine, $t0 + $day)[0] === 'image/jpeg', 'second save replaces the first');
check((int)$pdo->query('SELECT COUNT(*) FROM meal_photos')->fetchColumn() === 1, 'still one row per meal');

// seven days: still there on day 6, gone after 7; the text stays
check(meal_photo_fetch($pdo, 1, $mine, $t0 + $day + 6 * $day) !== null, 'still available on day 6');
$info = meal_photo_info($pdo, 1, [$mine], $t0 + $day + 8 * $day);
check($info[$mine]['has_photo'] === false && $info[$mine]['summary'] === 'New', 'after 7 days: no photo, text kept');
check(meal_photo_fetch($pdo, 1, $mine, $t0 + $day + 8 * $day) === null, 'expired photo is not served');
check($pdo->query('SELECT image FROM meal_photos')->fetchColumn() === null, 'and the image bytes are cleared from the database');

// storing a new photo clears everyone's expired images
$old = $entry(3);
meal_photo_store($pdo, 3, $old, 'image/webp', $webp, null, null, $t0);
$fresh = $entry(4);
meal_photo_store($pdo, 4, $fresh, 'image/webp', $webp, null, null, $t0 + 9 * $day);
check($pdo->query("SELECT image FROM meal_photos WHERE meal_entry_id = $old")->fetchColumn() === null, 'expired image of another person cleared on the next save');
check($pdo->query("SELECT image FROM meal_photos WHERE meal_entry_id = $fresh")->fetchColumn() !== null, 'fresh image kept');

// the per-person cap drops the oldest first
for ($i = 0; $i < MEAL_PHOTO_MAX_ACTIVE + 3; $i++) {
    meal_photo_store($pdo, 5, $entry(5), 'image/webp', $webp, null, null, $t0 + $i);
}
$active = (int)$pdo->query('SELECT COUNT(*) FROM meal_photos WHERE user_id = 5 AND image IS NOT NULL')->fetchColumn();
check($active === MEAL_PHOTO_MAX_ACTIVE, "cap keeps $active photos");
$oldest = (int)$pdo->query('SELECT MIN(meal_entry_id) FROM meal_photos WHERE user_id = 5')->fetchColumn();
check($pdo->query("SELECT image FROM meal_photos WHERE meal_entry_id = $oldest")->fetchColumn() === null, 'the oldest photo was the one dropped');

// delete
meal_photo_delete($pdo, 2, $fresh);
check($pdo->query("SELECT COUNT(*) FROM meal_photos WHERE meal_entry_id = $fresh")->fetchColumn() == 1, "another user cannot delete it");
meal_photo_delete($pdo, 4, $fresh);
check($pdo->query("SELECT COUNT(*) FROM meal_photos WHERE meal_entry_id = $fresh")->fetchColumn() == 0, 'owner can delete it');

echo "meal_photo tests passed\n";

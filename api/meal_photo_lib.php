<?php
declare(strict_types=1);

// Helpers for api/meal_photo.php (kept separate so tools/test_meal_photo.php can load them without a
// web server): validating an uploaded thumbnail and the database work around it.
// A photo lives for MEAL_PHOTO_DAYS after it was saved; then the image is cleared and only the text is kept.

const MEAL_PHOTO_DAYS = 7;
const MEAL_PHOTO_MAX_BYTES = 150000;   // decoded; the app sends ~400 px WebP/JPEG of about 15-45 KB
const MEAL_PHOTO_MAX_ACTIVE = 60;      // photos kept per person at once; the oldest go first

function meal_photo_cutoff(?int $now = null): string
{
    return date('Y-m-d H:i:s', ($now ?? time()) - MEAL_PHOTO_DAYS * 86400);
}

// Returns [mime, bytes] for a data URL holding a WebP or JPEG, or throws InvalidArgumentException
// with a message that is safe to show.
function meal_photo_validate($dataUrl): array
{
    if (!is_string($dataUrl) || !preg_match('#^data:image/(webp|jpeg);base64,([A-Za-z0-9+/=]+)$#', $dataUrl, $m)) {
        throw new InvalidArgumentException('That photo could not be read.');
    }
    $bytes = base64_decode($m[2], true);
    if ($bytes === false || strlen($bytes) < 12) {
        throw new InvalidArgumentException('That photo could not be read.');
    }
    if (strlen($bytes) > MEAL_PHOTO_MAX_BYTES) {
        throw new InvalidArgumentException('That photo is too large.');
    }
    // Trust the bytes, not the label the client chose.
    $isWebp = substr($bytes, 0, 4) === 'RIFF' && substr($bytes, 8, 4) === 'WEBP';
    $isJpeg = strncmp($bytes, "\xFF\xD8\xFF", 3) === 0;
    if (($m[1] === 'webp' && !$isWebp) || ($m[1] === 'jpeg' && !$isJpeg)) {
        throw new InvalidArgumentException('That photo could not be read.');
    }
    return ['image/' . $m[1], $bytes];
}

function meal_photo_clean_text($text, int $max): ?string
{
    $text = preg_replace('/[\x00-\x1F\x7F]+/u', ' ', (string)$text) ?? '';
    $text = trim($text);
    return $text === '' ? null : mb_substr($text, 0, $max);
}

// Saves (or replaces) the photo for one of this person's meal entries. False when the entry is not theirs.
function meal_photo_store(PDO $pdo, int $userId, int $entryId, string $mime, string $bytes, ?string $summary, ?string $confidence, ?int $now = null): bool
{
    $own = $pdo->prepare('SELECT id FROM meal_entries WHERE id = ? AND user_id = ?');
    $own->execute([$entryId, $userId]);
    if (!$own->fetch()) {
        return false;
    }
    $stmt = $pdo->prepare(
        'REPLACE INTO meal_photos (meal_entry_id, user_id, mime, image, summary, confidence, created_at) VALUES (?, ?, ?, ?, ?, ?, ?)'
    );
    $stmt->bindValue(1, $entryId, PDO::PARAM_INT);
    $stmt->bindValue(2, $userId, PDO::PARAM_INT);
    $stmt->bindValue(3, $mime);
    $stmt->bindValue(4, $bytes, PDO::PARAM_LOB);
    $stmt->bindValue(5, $summary);
    $stmt->bindValue(6, $confidence);
    $stmt->bindValue(7, date('Y-m-d H:i:s', $now ?? time()));
    $stmt->execute();
    meal_photo_trim($pdo, $userId, $now);
    return true;
}

// Clears every expired image (keeps the text), then enforces the per-person cap, oldest first.
function meal_photo_trim(PDO $pdo, int $userId, ?int $now = null): void
{
    $pdo->prepare('UPDATE meal_photos SET image = NULL, mime = NULL WHERE image IS NOT NULL AND created_at < ?')
        ->execute([meal_photo_cutoff($now)]);
    $stmt = $pdo->prepare('SELECT meal_entry_id FROM meal_photos WHERE user_id = ? AND image IS NOT NULL ORDER BY created_at DESC, meal_entry_id DESC');
    $stmt->execute([$userId]);
    $ids = array_slice($stmt->fetchAll(PDO::FETCH_COLUMN), MEAL_PHOTO_MAX_ACTIVE);
    foreach ($ids as $id) {
        $pdo->prepare('UPDATE meal_photos SET image = NULL, mime = NULL WHERE meal_entry_id = ?')->execute([(int)$id]);
    }
}

// [mime, bytes] for a photo that belongs to this person and is still inside its 7 days, else null.
function meal_photo_fetch(PDO $pdo, int $userId, int $entryId, ?int $now = null): ?array
{
    $stmt = $pdo->prepare('SELECT mime, image, created_at FROM meal_photos WHERE meal_entry_id = ? AND user_id = ?');
    $stmt->execute([$entryId, $userId]);
    $row = $stmt->fetch();
    if (!$row || $row['image'] === null) {
        return null;
    }
    if ($row['created_at'] < meal_photo_cutoff($now)) {
        $pdo->prepare('UPDATE meal_photos SET image = NULL, mime = NULL WHERE meal_entry_id = ?')->execute([$entryId]);
        return null;
    }
    $bytes = is_resource($row['image']) ? stream_get_contents($row['image']) : (string)$row['image'];
    return [(string)$row['mime'], $bytes];
}

// What the day view needs per meal entry (no image bytes): entry id => [has_photo, summary, confidence].
function meal_photo_info(PDO $pdo, int $userId, array $entryIds, ?int $now = null): array
{
    if (!$entryIds) {
        return [];
    }
    $marks = implode(',', array_fill(0, count($entryIds), '?'));
    $stmt = $pdo->prepare(
        "SELECT meal_entry_id, summary, confidence, (CASE WHEN image IS NOT NULL AND created_at >= ? THEN 1 ELSE 0 END) AS has_photo
         FROM meal_photos WHERE user_id = ? AND meal_entry_id IN ($marks)"
    );
    $stmt->execute(array_merge([meal_photo_cutoff($now), $userId], array_map('intval', $entryIds)));
    $out = [];
    foreach ($stmt->fetchAll() as $row) {
        $out[(int)$row['meal_entry_id']] = ['has_photo' => (int)$row['has_photo'] === 1, 'summary' => $row['summary'], 'confidence' => $row['confidence']];
    }
    return $out;
}

function meal_photo_delete(PDO $pdo, int $userId, int $entryId): void
{
    $pdo->prepare('DELETE FROM meal_photos WHERE meal_entry_id = ? AND user_id = ?')->execute([$entryId, $userId]);
}

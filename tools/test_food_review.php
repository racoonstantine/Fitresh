<?php
declare(strict_types=1);
// Food review logic against in-memory SQLite: opt-in only, one vote per user,
// normalised per 100 g / per serving, grouping of name variants, decisions.
require __DIR__ . '/../api/food_review_lib.php';

function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
$pdo = new PDO('sqlite::memory:', null, null, [PDO::ATTR_ERRMODE => PDO::ERRMODE_EXCEPTION, PDO::ATTR_DEFAULT_FETCH_MODE => PDO::FETCH_ASSOC]);
$pdo->exec("CREATE TABLE user_data(user_id INTEGER, resource_key TEXT, value TEXT);
CREATE TABLE foods(id INTEGER PRIMARY KEY AUTOINCREMENT, owner_user_id INTEGER, source TEXT, name TEXT, canonical_amount REAL, canonical_unit TEXT);
CREATE TABLE nutrients(id INTEGER PRIMARY KEY, code TEXT);
CREATE TABLE food_nutrients(food_id INTEGER, nutrient_id INTEGER, value_per_canonical REAL);
CREATE TABLE food_review_log(id INTEGER PRIMARY KEY AUTOINCREMENT, norm_key TEXT, unit_kind TEXT, decision TEXT, users_at_time INTEGER, created_at TEXT, updated_at TEXT, UNIQUE(norm_key, unit_kind));");
foreach (FOOD_REVIEW_NUTRIENTS as $i => $code) $pdo->prepare('INSERT INTO nutrients VALUES (?,?)')->execute([$i + 1, $code]);
$nid = fn(string $code) => array_search($code, FOOD_REVIEW_NUTRIENTS, true) + 1;
function optIn(PDO $pdo, int $user, bool $on = true): void {
    $pdo->prepare('DELETE FROM user_data WHERE user_id = ? AND resource_key = ?')->execute([$user, 'sharing']);
    $pdo->prepare('INSERT INTO user_data VALUES (?,?,?)')->execute([$user, 'sharing', json_encode(['foods' => $on])]);
}
function food(PDO $pdo, callable $nid, int $owner, string $source, string $name, float $amount, string $unit, array $n): int {
    $pdo->prepare('INSERT INTO foods (owner_user_id, source, name, canonical_amount, canonical_unit) VALUES (?,?,?,?,?)')->execute([$owner, $source, $name, $amount, $unit]);
    $id = (int)$pdo->lastInsertId();
    foreach ($n as $code => $v) $pdo->prepare('INSERT INTO food_nutrients VALUES (?,?,?)')->execute([$id, $nid($code), $v]);
    return $id;
}

// key normalisation
check(food_review_key('Chicken Adobo!') === food_review_key('adobo, CHICKEN'), 'word order / punctuation / case do not matter');
check(food_review_key('Chicken Adobo') !== food_review_key('Chicken Curry'), 'different foods stay different');

// Five users; four opt in. Three of them made adobo (different names / amounts), one made it twice.
foreach ([1, 2, 3, 4] as $u) optIn($pdo, $u);
optIn($pdo, 5, false);
food($pdo, $nid, 1, 'ai', 'Chicken Adobo', 250, 'g', ['ENERC_KCAL' => 410, 'PROCNT' => 32, 'FAT' => 22, 'CHOCDF' => 8]);       // 164 kcal /100g
food($pdo, $nid, 2, 'manual', 'adobo chicken', 100, 'g', ['ENERC_KCAL' => 170, 'PROCNT' => 15, 'FAT' => 9, 'CHOCDF' => 4]);      // 170
food($pdo, $nid, 3, 'ai', 'Chicken adobo', 200, 'g', ['ENERC_KCAL' => 340, 'PROCNT' => 28, 'FAT' => 18, 'CHOCDF' => 6]);         // 170
food($pdo, $nid, 3, 'ai', 'Chicken Adobo', 200, 'g', ['ENERC_KCAL' => 360, 'PROCNT' => 28, 'FAT' => 18, 'CHOCDF' => 6]);         // newer: 180, replaces the older one
food($pdo, $nid, 5, 'ai', 'Chicken Adobo', 100, 'g', ['ENERC_KCAL' => 900]);                                                     // opted out: ignored
food($pdo, $nid, 1, 'ai', 'Rice porridge', 100, 'g', ['ENERC_KCAL' => 60]);                                                       // only one user
food($pdo, $nid, 4, 'catalog', 'Chicken Adobo', 100, 'g', ['ENERC_KCAL' => 500]);                                                // not a user-made source
$c = food_review_candidates($pdo);
check(count($c) === 1, 'exactly one candidate (adobo), got ' . count($c));
$a = $c[0];
check($a['users'] === 3, 'three distinct users, opted-out and catalog rows excluded');
check($a['ai_users'] === 2 && $a['manual_users'] === 1, 'origin mix');
check($a['basis'] === 'per 100 g', 'basis');
check($a['nutrients']['ENERC_KCAL']['median'] === 170.0, 'median kcal/100g is 170, got ' . $a['nutrients']['ENERC_KCAL']['median']);
check($a['nutrients']['ENERC_KCAL']['min'] === 164.0 && $a['nutrients']['ENERC_KCAL']['max'] === 180.0, 'newest entry per user counts, per-100g normalised');
check($a['flag'] === 'consistent', 'tight spread is consistent');
check($a['status'] === 'new', 'status new');
check(!array_key_exists('owner_user_id', $a) && !str_contains(json_encode($a), 'user_id'), 'no user identifiers in the output');

// a fourth user who disagrees a lot -> high_variance
food($pdo, $nid, 4, 'ai', 'Chicken Adobo', 100, 'g', ['ENERC_KCAL' => 420]);
$a = food_review_candidates($pdo)[0];
check($a['users'] === 4 && $a['flag'] === 'high_variance', 'a user 2.5x off flags high variance: ' . json_encode($a['flag']));
// minimum users
check(count(food_review_candidates($pdo, 5)) === 0, 'min users is respected');

// per-serving foods are grouped separately from per-100g ones
foreach ([1, 2, 3] as $u) food($pdo, $nid, $u, 'manual', 'Turon', 1, 'serving', ['ENERC_KCAL' => 200 + $u * 10]);
$byBasis = array_column(food_review_candidates($pdo), 'basis', 'key');
check(($byBasis['turon'] ?? '') === 'per serving', 'servings are their own group');

// decisions
food_review_record($pdo, 'turon', 'serving', 'sent', 3);
$turon = array_values(array_filter(food_review_candidates($pdo), fn($x) => $x['key'] === 'turon'))[0];
check($turon['status'] === 'sent', 'sent candidates stay listed, marked sent');
food_review_record($pdo, 'turon', 'serving', 'dismissed');
check(!in_array('turon', array_column(food_review_candidates($pdo), 'key'), true), 'dismissed candidates disappear');
food_review_record($pdo, food_review_key('Chicken Adobo'), 'g', 'reviewed');
check(!in_array('adobo chicken', array_column(food_review_candidates($pdo), 'key'), true), 'reviewed candidates disappear');
check((int)$pdo->query('SELECT COUNT(*) FROM food_review_log')->fetchColumn() === 2, 'one row per key (updates, not duplicates)');

// opting out later removes a user's vote
optIn($pdo, 1, false);
optIn($pdo, 2, false);
optIn($pdo, 3, false);
check(food_review_candidates($pdo) === [], 'no opted-in users, nothing to review');

// digest text
$digest = food_review_digest_text([['name' => 'Chicken Adobo', 'users' => 4, 'ai_users' => 3, 'manual_users' => 1, 'basis' => 'per 100 g', 'flag' => 'high_variance', 'kcal_spread_pct' => 40,
    'nutrients' => ['ENERC_KCAL' => ['median' => 170, 'min' => 164, 'max' => 420, 'n' => 4], 'PROCNT' => ['median' => 15, 'min' => 1, 'max' => 2, 'n' => 4]]]]);
check(str_contains($digest, 'Chicken Adobo') && str_contains($digest, 'users disagree by ~40%') && str_contains($digest, 'Nothing is published automatically'), 'digest text');
echo "PASS: food review (opt-in only, one vote per user, per-100g normalisation, grouping, variance flag, decisions, digest text).\n";

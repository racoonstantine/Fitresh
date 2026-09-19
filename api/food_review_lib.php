<?php
declare(strict_types=1);
require_once __DIR__ . '/catalog.php';

// Food review: finds AI Assist / My Entry foods that several *different* users
// made independently, so an admin can check them against a real source and
// consider adding a verified version to the food list. Nothing is published
// automatically.
//
// Privacy: only users who switched on "Help improve the food list"
// (user_data resource 'sharing' = {"foods": true}) are considered, and the
// result carries food names and nutrition only -- never a user id or email.

const FOOD_REVIEW_MIN_USERS = 3;
const FOOD_REVIEW_NUTRIENTS = ['ENERC_KCAL', 'PROCNT', 'FAT', 'CHOCDF', 'NA', 'FIBTG', 'CHOLE'];

// Same "hasn't been migrated on this server yet" guard used elsewhere.
function food_review_available(PDO $pdo): bool
{
    try {
        $pdo->query('SELECT id FROM food_review_log LIMIT 0');
        return true;
    } catch (PDOException $e) {
        if ($e->getCode() === '42S02' || str_contains($e->getMessage(), 'no such table')) {
            return false;
        }
        throw $e;
    }
}

function food_review_opted_in_users(PDO $pdo): array
{
    $ids = [];
    foreach ($pdo->query("SELECT user_id, value FROM user_data WHERE resource_key = 'sharing'") as $row) {
        $value = json_decode((string)$row['value'], true);
        if (is_array($value) && ($value['foods'] ?? false) === true) {
            $ids[] = (int)$row['user_id'];
        }
    }
    return $ids;
}

// "Chicken Adobo!" and "adobo, chicken" are the same food for grouping purposes.
function food_review_key(string $name): string
{
    $tokens = array_values(array_unique(array_filter(explode(' ', catalog_normalize($name)), fn($t) => $t !== '')));
    sort($tokens);
    return substr(implode(' ', $tokens), 0, 180);
}

function food_review_median(array $values): float
{
    sort($values);
    $n = count($values);
    $mid = intdiv($n, 2);
    return $n % 2 ? (float)$values[$mid] : ((float)$values[$mid - 1] + (float)$values[$mid]) / 2;
}

// Candidates: groups of similar foods made by at least $minUsers different
// opted-in users. Each user counts once (their newest matching food), so one
// person logging the same dish repeatedly cannot inflate a group.
function food_review_candidates(PDO $pdo, int $minUsers = FOOD_REVIEW_MIN_USERS): array
{
    $users = food_review_opted_in_users($pdo);
    if (!$users) {
        return [];
    }
    $marks = implode(',', array_fill(0, count($users), '?'));
    $stmt = $pdo->prepare(
        "SELECT id, owner_user_id, source, name, canonical_amount, canonical_unit FROM foods
         WHERE source IN ('ai','manual','custom') AND owner_user_id IN ($marks) ORDER BY id"
    );
    $stmt->execute($users);
    $foods = $stmt->fetchAll();
    if (!$foods) {
        return [];
    }

    // Nutrients for those foods, in chunks so the IN list stays small.
    $nutrients = [];
    foreach (array_chunk(array_column($foods, 'id'), 400) as $chunk) {
        $in = implode(',', array_fill(0, count($chunk), '?'));
        $ns = $pdo->prepare(
            "SELECT fn.food_id, n.code, fn.value_per_canonical FROM food_nutrients fn
             JOIN nutrients n ON n.id = fn.nutrient_id WHERE fn.food_id IN ($in)"
        );
        $ns->execute($chunk);
        foreach ($ns->fetchAll() as $row) {
            $nutrients[(int)$row['food_id']][$row['code']] = (float)$row['value_per_canonical'];
        }
    }

    // Decisions already taken.
    $decisions = [];
    if (food_review_available($pdo)) {
        foreach ($pdo->query('SELECT norm_key, unit_kind, decision FROM food_review_log') as $row) {
            $decisions[$row['norm_key'] . '|' . $row['unit_kind']] = $row['decision'];
        }
    }

    $groups = [];
    foreach ($foods as $food) {
        $key = food_review_key((string)$food['name']);
        $amount = (float)$food['canonical_amount'];
        if ($key === '' || $amount <= 0) {
            continue;
        }
        // Per 100 g / ml when the food is measured that way, otherwise per serving.
        $unitKind = in_array($food['canonical_unit'], ['g', 'ml'], true) ? $food['canonical_unit'] : 'serving';
        $factor = $unitKind === 'serving' ? 1 / $amount : 100 / $amount;
        $per = [];
        foreach (FOOD_REVIEW_NUTRIENTS as $code) {
            if (isset($nutrients[(int)$food['id']][$code])) {
                $per[$code] = $nutrients[(int)$food['id']][$code] * $factor;
            }
        }
        if (!isset($per['ENERC_KCAL'])) {
            continue;
        }
        $gk = $key . '|' . $unitKind;
        $groups[$gk]['key'] = $key;
        $groups[$gk]['unit_kind'] = $unitKind;
        $groups[$gk]['names'][$food['name']] = ($groups[$gk]['names'][$food['name']] ?? 0) + 1;
        $groups[$gk]['owners'][(int)$food['owner_user_id']] = ['source' => $food['source'], 'per' => $per]; // newest wins
    }

    $out = [];
    foreach ($groups as $gk => $g) {
        $decision = $decisions[$gk] ?? null;
        if (count($g['owners']) < $minUsers || in_array($decision, ['dismissed', 'reviewed'], true)) {
            continue;
        }
        $stats = [];
        foreach (FOOD_REVIEW_NUTRIENTS as $code) {
            $vals = [];
            foreach ($g['owners'] as $o) {
                if (isset($o['per'][$code])) {
                    $vals[] = $o['per'][$code];
                }
            }
            if ($vals) {
                $stats[$code] = ['median' => round(food_review_median($vals), 1), 'min' => round(min($vals), 1), 'max' => round(max($vals), 1), 'n' => count($vals)];
            }
        }
        $kcal = array_map(fn($o) => $o['per']['ENERC_KCAL'], array_values($g['owners']));
        $mean = array_sum($kcal) / count($kcal);
        $variance = array_sum(array_map(fn($v) => ($v - $mean) ** 2, $kcal)) / count($kcal);
        $cv = $mean > 0 ? sqrt($variance) / $mean : 0.0;
        arsort($g['names']);
        $aiUsers = count(array_filter($g['owners'], fn($o) => $o['source'] === 'ai'));
        $out[] = [
            'key' => $g['key'],
            'unit_kind' => $g['unit_kind'],
            'name' => (string)array_key_first($g['names']),
            'users' => count($g['owners']),
            'ai_users' => $aiUsers,
            'manual_users' => count($g['owners']) - $aiUsers,
            'basis' => $g['unit_kind'] === 'serving' ? 'per serving' : 'per 100 ' . $g['unit_kind'],
            'nutrients' => $stats,
            'kcal_spread_pct' => (int)round($cv * 100),
            // Users disagree by more than a quarter on calories: needs a real source before anything else.
            'flag' => $cv > 0.25 ? 'high_variance' : 'consistent',
            'status' => $decision === 'sent' ? 'sent' : 'new',
        ];
    }
    usort($out, fn($a, $b) => [$b['users'], $a['kcal_spread_pct']] <=> [$a['users'], $b['kcal_spread_pct']]);
    return array_slice($out, 0, 50);
}

function food_review_record(PDO $pdo, string $key, string $unitKind, string $decision, int $users = 0): void
{
    $now = date('Y-m-d H:i:s');
    $stmt = $pdo->prepare('SELECT id FROM food_review_log WHERE norm_key = ? AND unit_kind = ?');
    $stmt->execute([$key, $unitKind]);
    $id = $stmt->fetchColumn();
    if ($id) {
        $pdo->prepare('UPDATE food_review_log SET decision = ?, updated_at = ? WHERE id = ?')->execute([$decision, $now, $id]);
    } else {
        $pdo->prepare('INSERT INTO food_review_log (norm_key, unit_kind, decision, users_at_time, created_at, updated_at) VALUES (?,?,?,?,?,?)')
            ->execute([$key, $unitKind, $decision, $users, $now, $now]);
    }
}

function food_review_digest_text(array $candidates): string
{
    $lines = ['Foods that several different users logged as AI Assist / My Entry (opted-in users only).',
        'Check each against a real source before adding it to the food list. Nothing is published automatically.', ''];
    foreach ($candidates as $c) {
        $n = $c['nutrients'];
        $get = fn($code) => isset($n[$code]) ? (string)$n[$code]['median'] : '?';
        $lines[] = sprintf('- %s  (%d users: %d AI, %d manual; %s)', $c['name'], $c['users'], $c['ai_users'], $c['manual_users'], $c['basis']);
        $lines[] = sprintf('    kcal %s (range %s-%s) | protein %s g | fat %s g | carbs %s g | sodium %s mg%s',
            $get('ENERC_KCAL'), $n['ENERC_KCAL']['min'] ?? '?', $n['ENERC_KCAL']['max'] ?? '?', $get('PROCNT'), $get('FAT'), $get('CHOCDF'), $get('NA'),
            $c['flag'] === 'high_variance' ? sprintf('  << users disagree by ~%d%% on calories', $c['kcal_spread_pct']) : '');
    }
    $lines[] = '';
    $lines[] = 'Open Me > Admin > Food review to mark items reviewed or dismissed.';
    return implode("\n", $lines);
}

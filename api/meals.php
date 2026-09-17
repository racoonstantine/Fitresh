<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require_once __DIR__ . '/food_measurements.php';

header('Content-Type: application/json');
start_app_session();

if (empty($_SESSION['user_id'])) {
    json_respond(['error' => 'Not logged in'], 401);
}
$userId = (int)$_SESSION['user_id'];
$pdo = get_db();

const MEAL_TYPES = ['breakfast', 'lunch', 'dinner', 'snack', 'custom'];

// Scales a food's per-canonical-amount nutrients to the logged amount and
// sums them into $totals (code => value), used for both a single component
// and a whole day.
function add_scaled_nutrients(PDO $pdo, array &$totals, int $foodId, float $amount): void
{
    $stmt = $pdo->prepare('SELECT canonical_amount FROM foods WHERE id = ?');
    $stmt->execute([$foodId]);
    $food = $stmt->fetch();
    if (!$food) {
        return;
    }
    $factor = $food['canonical_amount'] > 0 ? $amount / (float)$food['canonical_amount'] : 0;

    $stmt = $pdo->prepare(
        'SELECT n.code, fn.value_per_canonical FROM food_nutrients fn
         JOIN nutrients n ON n.id = fn.nutrient_id WHERE fn.food_id = ?'
    );
    $stmt->execute([$foodId]);
    foreach ($stmt->fetchAll() as $row) {
        $totals[$row['code']] = ($totals[$row['code']] ?? 0) + (float)$row['value_per_canonical'] * $factor;
    }
}

function component_summary(PDO $pdo, array $component): array
{
    $totals = [];
    if ($component['food_id']) {
        add_scaled_nutrients($pdo, $totals, (int)$component['food_id'], (float)$component['amount']);
        $stmt = $pdo->prepare('SELECT name, brand FROM foods WHERE id = ?');
        $stmt->execute([$component['food_id']]);
        $food = $stmt->fetch();
        $name = $food ? $food['name'] : $component['custom_name'];
    } else {
        $totals = [
            'ENERC_KCAL' => (float)($component['manual_calories'] ?? 0),
            'PROCNT' => (float)($component['manual_protein'] ?? 0),
            'FAT' => (float)($component['manual_fat'] ?? 0),
            'CHOCDF' => (float)($component['manual_carbs'] ?? 0),
        ];
        $name = $component['custom_name'];
    }
    return [
        'id' => (int)$component['id'],
        'name' => $name,
        'amount' => (float)$component['amount'],
        'unit' => $component['unit'],
        'source' => $component['source'],
        'nutrients' => $totals,
    ];
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'GET' && $action === 'day') {
    $date = (string)($_GET['date'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date)) {
        json_respond(['error' => 'Invalid date.'], 400);
    }

    $stmt = $pdo->prepare('SELECT * FROM meal_entries WHERE user_id = ? AND entry_date = ? ORDER BY id');
    $stmt->execute([$userId, $date]);
    $entries = $stmt->fetchAll();

    $compStmt = $pdo->prepare('SELECT * FROM meal_components WHERE meal_entry_id = ? ORDER BY sort_order, id');
    $dayTotals = [];
    $result = [];
    foreach ($entries as $entry) {
        $compStmt->execute([$entry['id']]);
        $components = [];
        foreach ($compStmt->fetchAll() as $c) {
            $summary = component_summary($pdo, $c);
            foreach ($summary['nutrients'] as $code => $val) {
                $dayTotals[$code] = ($dayTotals[$code] ?? 0) + $val;
            }
            $components[] = $summary;
        }
        $result[] = [
            'id' => (int)$entry['id'],
            'meal_type' => $entry['meal_type'],
            'display_name' => $entry['display_name'],
            'components' => $components,
        ];
    }
    json_respond(['entries' => $result, 'totals' => $dayTotals]);
}

if ($method === 'GET' && $action === 'range_totals') {
    // Per-date nutrient totals over a date range, for merging search-logged
    // meals into the legacy nutritionLog-driven dashboard (cards/macro bar).
    $start = (string)($_GET['start'] ?? '');
    $end = (string)($_GET['end'] ?? '');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $start) || !preg_match('/^\d{4}-\d{2}-\d{2}$/', $end)) {
        json_respond(['error' => 'Invalid date range.'], 400);
    }

    $stmt = $pdo->prepare('SELECT id, entry_date FROM meal_entries WHERE user_id = ? AND entry_date BETWEEN ? AND ?');
    $stmt->execute([$userId, $start, $end]);
    $entryDates = [];
    foreach ($stmt->fetchAll() as $row) {
        $entryDates[(int)$row['id']] = $row['entry_date'];
    }

    $totalsByDate = [];
    if ($entryDates) {
        $ids = array_keys($entryDates);
        $placeholders = implode(',', array_fill(0, count($ids), '?'));
        $compStmt = $pdo->prepare("SELECT * FROM meal_components WHERE meal_entry_id IN ($placeholders)");
        $compStmt->execute($ids);
        foreach ($compStmt->fetchAll() as $c) {
            $date = $entryDates[(int)$c['meal_entry_id']];
            $summary = component_summary($pdo, $c);
            foreach ($summary['nutrients'] as $code => $val) {
                $totalsByDate[$date][$code] = ($totalsByDate[$date][$code] ?? 0) + $val;
            }
        }
    }
    json_respond(['totals' => $totalsByDate]);
}

if ($method === 'POST' && $action === 'log') {
    $date = (string)($input['date'] ?? '');
    $mealType = (string)($input['meal_type'] ?? 'snack');
    if (!preg_match('/^\d{4}-\d{2}-\d{2}$/', $date) || !in_array($mealType, MEAL_TYPES, true)) {
        json_respond(['error' => 'Invalid date or meal type.'], 400);
    }
    $component = $input['component'] ?? [];
    $foodId = isset($component['food_id']) ? (int)$component['food_id'] : null;
    $amount = (float)($component['amount'] ?? 100);
    $unit = (string)($component['unit'] ?? 'g');
    try {
        if ($foodId) {
            $measurement = meal_food_measurement($pdo, $foodId, $userId, $component);
            $amount = $measurement['amount'];
            $unit = $measurement['unit'];
        } elseif (!is_finite($amount) || $amount <= 0 || $amount > 99999999.99 || strlen($unit) > 8) {
            throw new InvalidArgumentException('Invalid amount or unit.');
        }
    } catch (InvalidArgumentException $e) {
        json_respond(['error' => $e->getMessage()], 400);
    }

    // One meal entry per user/date/type/display_name group -- reuse an existing one so
    // logging several foods under "Lunch" today groups them together.
    $displayName = trim((string)($input['display_name'] ?? '')) ?: null;
    $stmt = $pdo->prepare(
        'SELECT id FROM meal_entries WHERE user_id = ? AND entry_date = ? AND meal_type = ?
         AND display_name <=> ? LIMIT 1'
    );
    $stmt->execute([$userId, $date, $mealType, $displayName]);
    $entry = $stmt->fetch();
    if ($entry) {
        $entryId = (int)$entry['id'];
    } else {
        $stmt = $pdo->prepare(
            'INSERT INTO meal_entries (user_id, entry_date, meal_type, display_name, created_at) VALUES (?, ?, ?, ?, NOW())'
        );
        $stmt->execute([$userId, $date, $mealType, $displayName]);
        $entryId = (int)$pdo->lastInsertId();
    }

    $stmt = $pdo->prepare(
        'INSERT INTO meal_components
         (meal_entry_id, food_id, custom_name, amount, unit, manual_calories, manual_protein, manual_fat, manual_carbs, source, sort_order)
         VALUES (?, ?, ?, ?, ?, ?, ?, ?, ?, ?, 0)'
    );
    $stmt->execute([
        $entryId,
        $foodId,
        $foodId ? null : trim((string)($component['custom_name'] ?? 'Item')),
        $amount,
        $unit,
        $foodId ? null : ($component['manual_calories'] ?? null),
        $foodId ? null : ($component['manual_protein'] ?? null),
        $foodId ? null : ($component['manual_fat'] ?? null),
        $foodId ? null : ($component['manual_carbs'] ?? null),
        $foodId ? 'database' : 'manual',
    ]);

    json_respond(['ok' => true, 'meal_entry_id' => $entryId]);
}

if ($method === 'POST' && $action === 'delete_component') {
    $componentId = (int)($input['id'] ?? 0);
    // Ownership check via subquery, so a user can't delete another user's component by guessing an id.
    $stmt = $pdo->prepare(
        'DELETE FROM meal_components
         WHERE id = ? AND meal_entry_id IN (SELECT id FROM meal_entries WHERE user_id = ?)'
    );
    $stmt->execute([$componentId, $userId]);
    json_respond(['ok' => true]);
}

if ($method === 'POST' && $action === 'update_component') {
    // Correcting a logged amount -- only the amount/unit change; the food itself
    // (and its nutrient record) is untouched, so nutrients continue to scale from it.
    $componentId = (int)($input['id'] ?? 0);
    $amount = (float)($input['amount'] ?? 0);
    if ($componentId <= 0 || $amount <= 0) {
        json_respond(['error' => 'Invalid amount.'], 400);
    }
    $unit = (string)($input['unit'] ?? 'g');
    $owned = $pdo->prepare('SELECT food_id FROM meal_components WHERE id = ? AND meal_entry_id IN (SELECT id FROM meal_entries WHERE user_id = ?)');
    $owned->execute([$componentId, $userId]);
    $existing = $owned->fetch();
    if (!$existing) json_respond(['error' => 'Meal component unavailable.'], 404);
    try {
        if ($existing['food_id']) {
            $measurement = meal_food_measurement($pdo, (int)$existing['food_id'], $userId, $input);
            $amount = $measurement['amount'];
            $unit = $measurement['unit'];
        } elseif (!is_finite($amount) || $amount > 99999999.99 || strlen($unit) > 8) {
            throw new InvalidArgumentException('Invalid amount or unit.');
        }
    } catch (InvalidArgumentException $e) {
        json_respond(['error' => $e->getMessage()], 400);
    }
    $stmt = $pdo->prepare(
        'UPDATE meal_components SET amount = ?, unit = ?
         WHERE id = ? AND meal_entry_id IN (SELECT id FROM meal_entries WHERE user_id = ?)'
    );
    $stmt->execute([$amount, $unit, $componentId, $userId]);
    json_respond(['ok' => true]);
}

json_respond(['error' => 'Unknown action'], 400);

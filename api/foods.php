<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/personal_foods_store.php';

header('Content-Type: application/json');
start_app_session();
require_json_request();

if (empty($_SESSION['user_id'])) {
    json_respond(['error' => 'Not logged in'], 401);
}
$userId = (int)$_SESSION['user_id'];
$pdo = get_db();

function nutrient_ids(PDO $pdo): array
{
    static $map = null;
    if ($map === null) {
        $map = [];
        foreach ($pdo->query('SELECT id, code FROM nutrients') as $row) {
            $map[$row['code']] = (int)$row['id'];
        }
    }
    return $map;
}

function food_with_nutrients(PDO $pdo, int $foodId): array
{
    $stmt = $pdo->prepare('SELECT * FROM foods WHERE id = ?');
    $stmt->execute([$foodId]);
    $food = $stmt->fetch();

    $stmt = $pdo->prepare(
        'SELECT n.code, fn.value_per_canonical FROM food_nutrients fn
         JOIN nutrients n ON n.id = fn.nutrient_id WHERE fn.food_id = ?'
    );
    $stmt->execute([$foodId]);
    $nutrients = [];
    foreach ($stmt->fetchAll() as $row) {
        $nutrients[$row['code']] = (float)$row['value_per_canonical'];
    }
    $food['nutrients'] = $nutrients;
    if (($food['source'] ?? '') === 'personal') {
        $food['personal_food'] = personal_food_metadata($pdo,$foodId);
        $food['label'] = 'User entered · Private';
        $food['complete'] = count(array_intersect(['ENERC_KCAL','PROCNT','CHOCDF','FAT','FIBTG','SUGAR','NA','CHOLE'],array_keys($nutrients))) === 8;
    }
    if (($food['source'] ?? '') === 'catalog') {
        try {
            $snapshot = catalog_food((string)$food['external_id']);
            $food['label'] = $snapshot['label'];
            $food['complete'] = $snapshot['complete'];
            $food['confidence'] = $snapshot['confidence'] ?? null;
            $food['nutrient_provenance'] = $snapshot['nutrient_provenance'];
            $food['portions'] = $snapshot['portions'] ?? [];
        } catch (Throwable $e) {
            $food['label'] = 'Catalog — source details unavailable';
        }
    }
    return $food;
}

$method = $_SERVER['REQUEST_METHOD'];
$action = $_GET['action'] ?? '';
$input = json_decode(file_get_contents('php://input'), true) ?? [];

if ($method === 'GET' && $action === 'search_library') {
    // Foods this user can reuse without hitting an external API: their own
    // custom foods, plus anything (of anyone's) already cached from a previous search-and-log.
    $query = trim((string)($_GET['q'] ?? ''));
    if ($query === '') {
        json_respond(['results' => []]);
    }
    $currentFilter = personal_foods_available($pdo) ? ' AND NOT EXISTS (SELECT 1 FROM personal_food_versions v WHERE v.food_id=foods.id AND v.is_current=0)' : '';
    $stmt = $pdo->prepare(
        'SELECT id FROM foods
         WHERE (owner_user_id = ? OR owner_user_id IS NULL) AND name LIKE ?' . $currentFilter . '
         ORDER BY name LIMIT 20'
    );
    $stmt->execute([$userId, '%' . $query . '%']);
    // Include nutrients + canonical amount/unit so the frontend can show macros
    // and scale them before the food is actually logged.
    $results = array_map(fn($row) => food_with_nutrients($pdo, (int)$row['id']), $stmt->fetchAll());
    json_respond(['results' => $results]);
}

if ($method === 'POST' && $action === 'save_external') {
    // Persist a result from food_search.php into our own library the first time it's actually logged.
    $source = (string)($input['source'] ?? 'off');
    $externalId = trim((string)($input['external_id'] ?? ''));
    $name = trim((string)($input['name'] ?? ''));
    $brand = trim((string)($input['brand'] ?? '')) ?: null;
    $nutrients = $input['nutrients'] ?? [];
    if ($source === 'catalog') {
        try {
            // Only trust the selected immutable server snapshot, never client nutrient values.
            $selected = catalog_food($externalId);
            $name = $selected['name'];
            $brand = $selected['label'] . ' · Local food catalog';
            $nutrients = $selected['nutrients'];
            $input['canonical_unit'] = 'g';
        } catch (Throwable $e) {
            json_respond(['error' => 'Food source unavailable. Search again and select a food.'], 400);
        }
    } elseif ($source !== 'off') {
        json_respond(['error' => 'Unsupported food source'], 400);
    }
    if ($externalId === '' || $name === '') {
        json_respond(['error' => 'Missing food data.'], 400);
    }

    $stmt = $pdo->prepare('SELECT id FROM foods WHERE source = ? AND external_id = ?');
    $stmt->execute([$source, $externalId]);
    $existing = $stmt->fetch();
    if ($existing) {
        json_respond(food_with_nutrients($pdo, (int)$existing['id']));
    }

    $pdo->beginTransaction();
    $stmt = $pdo->prepare(
        'INSERT INTO foods (owner_user_id, source, external_id, name, brand, canonical_amount, canonical_unit, created_at, updated_at)
         VALUES (NULL, ?, ?, ?, ?, 100, ?, NOW(), NOW())'
    );
    $stmt->execute([$source, $externalId, $name, $brand, (string)($input['canonical_unit'] ?? 'g')]);
    $foodId = (int)$pdo->lastInsertId();

    $ids = nutrient_ids($pdo);
    $insertNutrient = $pdo->prepare(
        'INSERT INTO food_nutrients (food_id, nutrient_id, value_per_canonical) VALUES (?, ?, ?)'
    );
    foreach ($nutrients as $code => $value) {
        if ($value === null || $value === '' || !isset($ids[$code])) {
            continue;
        }
        $insertNutrient->execute([$foodId, $ids[$code], (float)$value]);
    }

    $pdo->commit();
    json_respond(food_with_nutrients($pdo, $foodId));
}

if ($method === 'POST' && $action === 'create_custom') {
    $name = trim((string)($input['name'] ?? ''));
    if ($name === '') {
        json_respond(['error' => 'Name is required.'], 400);
    }
    $nutrients = $input['nutrients'] ?? [];

    $stmt = $pdo->prepare(
        'INSERT INTO foods (owner_user_id, source, external_id, name, brand, canonical_amount, canonical_unit, created_at, updated_at)
         VALUES (?, ?, NULL, ?, NULL, ?, ?, NOW(), NOW())'
    );
    $stmt->execute([
        $userId, 'custom', $name,
        (float)($input['canonical_amount'] ?? 100),
        (string)($input['canonical_unit'] ?? 'g'),
    ]);
    $foodId = (int)$pdo->lastInsertId();

    $ids = nutrient_ids($pdo);
    $insertNutrient = $pdo->prepare(
        'INSERT INTO food_nutrients (food_id, nutrient_id, value_per_canonical) VALUES (?, ?, ?)'
    );
    foreach ($nutrients as $code => $value) {
        if ($value === null || $value === '' || !isset($ids[$code])) {
            continue;
        }
        $insertNutrient->execute([$foodId, $ids[$code], (float)$value]);
    }

    json_respond(food_with_nutrients($pdo, $foodId));
}

if ($method === 'GET' && $action === 'get') {
    $foodId = (int)($_GET['id'] ?? 0);
    if (!$foodId) {
        json_respond(['error' => 'Missing id.'], 400);
    }
    $visible=$pdo->prepare('SELECT id FROM foods WHERE id=? AND (owner_user_id IS NULL OR owner_user_id=?)');
    $visible->execute([$foodId,$userId]);
    if (!$visible->fetchColumn()) json_respond(['error'=>'Food unavailable'],404);
    json_respond(food_with_nutrients($pdo, $foodId));
}

json_respond(['error' => 'Unknown action'], 400);

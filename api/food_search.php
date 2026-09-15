<?php
declare(strict_types=1);
require __DIR__ . '/db.php';

header('Content-Type: application/json');
start_app_session();

if (empty($_SESSION['user_id'])) {
    json_respond(['error' => 'Not logged in'], 401);
}

$query = trim((string)($_GET['q'] ?? ''));
if (strlen($query) < 2) {
    json_respond(['results' => []]);
}

// Open Food Facts is free and needs no API key. Coverage skews toward
// packaged/branded products -- home-cooked and regional dishes often won't
// be here, which is exactly what "custom foods" (see api/foods.php) are for.
$url = 'https://world.openfoodfacts.org/cgi/search.pl?' . http_build_query([
    'search_terms' => $query,
    'search_simple' => 1,
    'action' => 'process',
    'json' => 1,
    'page_size' => 20,
    'fields' => 'product_name,brands,code,nutriments',
]);

$raw = http_get_with_fallback($url);
if ($raw === false) {
    json_respond(['results' => [], 'error' => 'Food search is temporarily unavailable.']);
}

$data = json_decode($raw, true);
if (json_last_error() !== JSON_ERROR_NONE) {
    // Not valid JSON -- e.g. a rate-limit/maintenance HTML page from the provider.
    // Distinct from "search succeeded, no matches" so the UI can tell the two apart.
    json_respond(['results' => [], 'error' => 'Food search is temporarily unavailable — try again in a moment.']);
}
$products = $data['products'] ?? [];

$results = [];
foreach ($products as $p) {
    $name = trim((string)($p['product_name'] ?? ''));
    $code = trim((string)($p['code'] ?? ''));
    if ($name === '' || $code === '') {
        continue;
    }
    $n = $p['nutriments'] ?? [];
    if (!isset($n['energy-kcal_100g'])) {
        continue; // no usable calorie data -- not worth showing
    }
    // OFF reports per-100g values; sodium/salt come in grams, our dictionary wants sodium in mg.
    $sodiumMg = isset($n['sodium_100g']) ? ((float)$n['sodium_100g'] * 1000) : null;

    $results[] = [
        'external_id' => $code,
        'name' => $name,
        'brand' => trim((string)($p['brands'] ?? '')) ?: null,
        'canonical_amount' => 100,
        'canonical_unit' => 'g',
        'nutrients' => [
            'ENERC_KCAL' => $n['energy-kcal_100g'] ?? null,
            'PROCNT' => $n['proteins_100g'] ?? null,
            'FAT' => $n['fat_100g'] ?? null,
            'CHOCDF' => $n['carbohydrates_100g'] ?? null,
            'FIBTG' => $n['fiber_100g'] ?? null,
            'SUGAR' => $n['sugars_100g'] ?? null,
            'FASAT' => $n['saturated-fat_100g'] ?? null,
            'NA' => $sodiumMg,
            'CHOLE' => $n['cholesterol_100g'] ?? null,
            'K' => $n['potassium_100g'] ?? null,
            'CA' => $n['calcium_100g'] ?? null,
            'FE' => $n['iron_100g'] ?? null,
        ],
    ];
    if (count($results) >= 20) {
        break;
    }
}

json_respond(['results' => $results]);

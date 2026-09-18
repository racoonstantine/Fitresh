<?php
declare(strict_types=1);
require_once __DIR__ . '/catalog.php';
require_once __DIR__ . '/personal_foods_store.php';

// Canonical amounts remain the storage/calculation basis. Never assume 1 ml = 1 g.
function food_measurement(array $food, array $input): array {
    $amount = filter_var($input['amount'] ?? null, FILTER_VALIDATE_FLOAT);
    if ($amount === false || !is_finite($amount) || $amount <= 0) {
        throw new InvalidArgumentException('Enter a positive amount.');
    }
    $base = (string)($food['canonical_unit'] ?? 'g');
    $unit = (string)($input['unit'] ?? $base);
    if ($unit === $base) $converted = $amount;
    elseif ($unit === 'serving' && ($food['source'] ?? '') === 'personal' && isset($food['personal_food']['definition'])) {
        $definition=$food['personal_food']['definition'];
        if ($definition['serving_measure'] !== $base) throw new InvalidArgumentException('Serving measure unavailable.');
        $converted=$amount*(float)$definition['serving_size'];
    }
    elseif ($base === 'g' && $unit === 'oz') $converted = $amount * 28.349523125;
    elseif ($base === 'oz' && $unit === 'g') $converted = $amount / 28.349523125;
    elseif ($base === 'g' && $unit === 'portion') {
        if (($food['source'] ?? '') !== 'catalog') throw new InvalidArgumentException('No documented portion for this food.');
        $snapshot = catalog_food((string)$food['external_id']);
        $matches = array_values(array_filter($snapshot['portions'] ?? [], fn($p) => $p['portion_id'] === ($input['portion_id'] ?? '')));
        if (count($matches) !== 1) throw new InvalidArgumentException('Select a documented portion for this food.');
        // Source weight describes the entire named serving, including its quantity.
        $converted = $amount * (float)$matches[0]['edible_weight_g'];
    } elseif ($base === 'g' && in_array($unit, ['personal_piece', 'personal_ml'], true)) {
        $weight = filter_var($input['grams_per_unit'] ?? null, FILTER_VALIDATE_FLOAT);
        if ($weight === false || !is_finite($weight) || $weight <= 0) throw new InvalidArgumentException('Enter your measured edible grams per piece or ml.');
        $converted = $amount * $weight;
    } else throw new InvalidArgumentException('This measure has no conversion for the selected food.');
    if (!is_finite($converted) || $converted < 0.01 || $converted > 99999999.99) throw new InvalidArgumentException('Converted amount is outside the supported range.');
    return ['amount' => round($converted, 2), 'unit' => $base];
}

function meal_food_measurement(PDO $pdo, int $foodId, int $userId, array $input): array {
    $stmt = $pdo->prepare('SELECT * FROM foods WHERE id = ? AND (owner_user_id IS NULL OR owner_user_id = ?)');
    $stmt->execute([$foodId, $userId]);
    $food = $stmt->fetch();
    if (!$food) throw new InvalidArgumentException('Food unavailable.');
    if ($food['source']==='personal') $food['personal_food']=personal_food_metadata($pdo,$foodId);
    return food_measurement($food, $input);
}

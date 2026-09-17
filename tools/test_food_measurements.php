<?php
require __DIR__ . '/../api/food_measurements.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
function rejects($food, $input) {
    try { food_measurement($food, $input); } catch (InvalidArgumentException $e) { return; }
    throw new RuntimeException('Unsafe measurement accepted: ' . json_encode($input));
}
$base = ['canonical_unit'=>'g'];
check(food_measurement($base, ['amount'=>2, 'unit'=>'oz'])['amount'] === 56.7, 'Ounces');
check(food_measurement($base, ['amount'=>2, 'unit'=>'personal_piece', 'grams_per_unit'=>75])['amount'] === 150.0, 'Personal pieces');
check(food_measurement($base, ['amount'=>250, 'unit'=>'personal_ml', 'grams_per_unit'=>1.03])['amount'] === 257.5, 'Personal density');
check(food_measurement(['canonical_unit'=>'ml'], ['amount'=>250,'unit'=>'ml'])['amount'] === 250.0, 'Native ml');
foreach ([0,-1,INF,NAN,'bad',0.001,1e10] as $amount) rejects($base,['amount'=>$amount,'unit'=>'g']);
foreach (['ml','fl oz','piece','cup','portion'] as $unit) rejects($base,['amount'=>1,'unit'=>$unit]);
rejects($base,['amount'=>1,'unit'=>'personal_ml','grams_per_unit'=>0]);
rejects(['canonical_unit'=>'ml'],['amount'=>10,'unit'=>'g']);
$catalog = catalog_load(); $count = 0; $multi = 0;
foreach ($catalog['foods'] as $id => $food) {
    $food['external_id'] = $catalog['version'].':'.$id;
    foreach ($food['portions'] as $portion) {
        $count++;
        $result = food_measurement($food,['amount'=>2,'unit'=>'portion','portion_id'=>$portion['portion_id'], 'grams_per_unit'=>999]);
        check($result['amount'] === round(2*(float)$portion['edible_weight_g'],2), 'Whole portion weight');
        if ((float)$portion['quantity'] !== 1.0) $multi++;
    }
    rejects($food,['amount'=>1,'unit'=>'portion','portion_id'=>'wrong-food-portion']);
}
check($count === 245 && $multi > 0, 'All documented portions and multi-unit servings tested');
echo "PASS: 245 sourced portions, ounces, personal pieces/density, native ml, unsupported and invalid measurements.\n";

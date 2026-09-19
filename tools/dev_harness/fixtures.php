<?php
declare(strict_types=1);
// Deterministic fixture for the dev harness user. Same content every run;
// dates are relative to "today" so Today/Train/History screens always have
// current data. Returns [resource_key => value] for user_data.

function harness_fixture(string $today): array
{
    $d = fn(int $ago) => date('Y-m-d', strtotime("$today -$ago days"));
    $weighIns = [];
    for ($i = 0; $i < 28; $i += 2) {
        $weighIns[] = ['date' => $d($i), 'kg' => round(89.0 + $i * 0.1 + ($i % 4 ? 0.2 : 0), 1)];
    }
    $nutrition = [];
    $water = [];
    $steps = [];
    $sleep = [];
    for ($i = 1; $i <= 14; $i++) {
        $date = $d($i);
        $nutrition[] = ['date' => $date, 'fastHours' => 14 + ($i % 4), 'meal' => 'Fixture day meals',
            'calories' => 1900 + ($i % 5) * 60, 'protein' => 120 + $i, 'fat' => 60 + ($i % 3) * 5,
            'carbs' => 180 + ($i % 4) * 10, 'notes' => ''];
        $water[$date] = 1800 + ($i % 4) * 300;
        $steps[$date] = 6000 + ($i % 5) * 1500;
        $wake = strtotime("$date 06:30:00");
        $hours = 6.5 + ($i % 4) * 0.5;
        $sleep[$date] = ['startIso' => gmdate('c', (int)($wake - $hours * 3600)), 'endIso' => gmdate('c', $wake), 'hours' => $hours];
    }
    $history = [
        ['date' => $d(1), 'day' => 'A', 'label' => 'Strength A', 'notes' => 'Felt strong.',
         'exercises' => [['name' => 'Goblet Squat', 'weight' => 20, 'sets' => 3, 'reps' => 10], ['name' => 'Plank', 'duration' => 1]],
         'stats' => null, 'loggedAt' => $d(1) . 'T18:00:00.000Z'],
        ['date' => $d(2), 'day' => 'steady', 'label' => 'Cardio Steady', 'notes' => '', 'exercises' => [],
         'stats' => ['distance' => '5', 'duration' => '00:40:00', 'calories' => '380', 'hr' => '132', 'pace' => '', 'steps' => '6800',
                     'maxHr' => '150', 'elevation' => '', 'trainingStress' => '', 'recoveryHr' => '', 'hrZones' => new stdClass()],
         'loggedAt' => $d(2) . 'T07:00:00.000Z'],
        ['date' => $d(4), 'day' => 'B', 'label' => 'Strength B', 'notes' => '',
         'exercises' => [['name' => 'Dumbbell Deadlift', 'weight' => 24, 'sets' => 3, 'reps' => 8]],
         'stats' => null, 'loggedAt' => $d(4) . 'T18:00:00.000Z'],
        ['date' => $d(5), 'day' => 'rest', 'label' => 'Rest day', 'notes' => '', 'exercises' => [], 'stats' => null, 'loggedAt' => $d(5) . 'T20:00:00.000Z'],
    ];
    $moderate = [['type' => 'rest'], ['type' => 'workoutPlan', 'planId' => 'strengthA'], ['type' => 'workoutPlan', 'planId' => 'cardioSteady'],
        ['type' => 'rest'], ['type' => 'workoutPlan', 'planId' => 'strengthB'], ['type' => 'workoutPlan', 'planId' => 'cardioInterval'],
        ['type' => 'workoutPlan', 'planId' => 'strengthA']];
    return [
        'profile' => ['gender' => 'male', 'age' => 34, 'heightCm' => 178, 'weightUnit' => 'kg', 'heightUnit' => 'cm',
            'activityLevel' => 'light', 'dietPreset' => 'balanced', 'currentWeightKg' => 89.0, 'goalWeightKg' => 82.0, 'notes' => null],
        'weighins' => $weighIns,
        'nutrition' => $nutrition,
        'water' => $water,
        'steps' => $steps,
        'sleep' => $sleep,
        'history' => $history,
        'fasting' => ['startIso' => null, 'goalHours' => 16],
        'trainingPlan' => ['presetKey' => 'moderate', 'name' => 'Moderate', 'days' => $moderate, 'overrides' => new stdClass()],
        'checked' => new stdClass(),
        'recentFoods' => [],
        'favoriteFoods' => [],
    ];
}

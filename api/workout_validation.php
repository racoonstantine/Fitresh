<?php
declare(strict_types=1);

function workout_number(array $data, string $key, float $min, float $max, bool $integer = false): ?float {
    $v = $data[$key] ?? null;
    if ($v === null || $v === '') return null;
    if (!is_numeric($v) || !is_finite((float)$v) || $v < $min || $v > $max || ($integer && floor((float)$v) != $v)) {
        throw new InvalidArgumentException('Invalid ' . $key);
    }
    return (float)$v;
}

function validate_workout(array $data, array $catalog): array {
    if (!preg_match('/^[a-f0-9]{8}-[a-f0-9]{4}-4[a-f0-9]{3}-[89ab][a-f0-9]{3}-[a-f0-9]{12}$/D', (string)($data['id'] ?? ''))) throw new InvalidArgumentException('Invalid session ID');
    $date = DateTimeImmutable::createFromFormat('!Y-m-d', (string)($data['date'] ?? ''));
    if (!$date || $date->format('Y-m-d') !== $data['date']) throw new InvalidArgumentException('Invalid date');
    $title = trim((string)($data['title'] ?? ''));
    if ($title === '' || strlen($title) > 140) throw new InvalidArgumentException('Enter a title (maximum 140 characters)');
    if (!in_array($data['style'] ?? '', ['straight', 'superset', 'circuit', 'interval', 'steady', 'sport'], true)) throw new InvalidArgumentException('Invalid style');
    $notes = (string)($data['notes'] ?? '');
    if (strlen($notes) > 4000) throw new InvalidArgumentException('Notes are too long');
    $timezone = (string)($data['timezone'] ?? 'UTC');
    try { new DateTimeZone($timezone); } catch (Exception $e) { throw new InvalidArgumentException('Invalid timezone'); }
    $items = $data['items'] ?? [];
    if (!is_array($items) || count($items) < 1 || count($items) > 50) throw new InvalidArgumentException('Add between 1 and 50 activities');
    $clean = [];
    foreach ($items as $item) {
        if (!is_array($item) || !isset($catalog[$item['activityId'] ?? ''])) throw new InvalidArgumentException('Unknown activity');
        $activity = $catalog[$item['activityId']];
        $sets = [];
        $metrics = [];
        if (in_array($activity['tracking'], ['reps', 'load', 'hold'], true)) {
            $inputSets = $item['sets'] ?? [];
            if (!is_array($inputSets) || count($inputSets) < 1 || count($inputSets) > 50) throw new InvalidArgumentException('Add between 1 and 50 sets');
            foreach ($inputSets as $set) {
                if (!is_array($set)) throw new InvalidArgumentException('Invalid set');
                $row = ['reps' => null, 'weightKg' => null, 'durationSeconds' => null];
                if ($activity['tracking'] === 'hold') {
                    $row['durationSeconds'] = workout_number($set, 'durationSeconds', 1, 86400, true);
                    if ($row['durationSeconds'] === null) throw new InvalidArgumentException('Enter seconds for each set');
                } else {
                    $row['reps'] = workout_number($set, 'reps', 1, 10000, true);
                    if ($row['reps'] === null) throw new InvalidArgumentException('Enter reps for each set');
                    if ($activity['tracking'] === 'load') {
                        $row['weightKg'] = workout_number($set, 'weightKg', 0, 2000);
                        if ($row['weightKg'] === null) throw new InvalidArgumentException('Enter a load for each set');
                    }
                }
                $sets[] = $row;
            }
        } else {
            $m = $item['metrics'] ?? [];
            if (!is_array($m)) throw new InvalidArgumentException('Invalid metrics');
            foreach (['durationSeconds' => [1,604800], 'distanceKm' => [0,10000], 'calories' => [0,100000], 'avgHr' => [20,300], 'effort' => [1,10]] as $key => $bounds) {
                $metrics[$key] = workout_number($m, $key, $bounds[0], $bounds[1]);
            }
            if ($metrics['durationSeconds'] === null) throw new InvalidArgumentException('Enter activity duration');
            // Catalog-declared session metrics are the only additional accepted measurements.
            foreach ($activity['measurements'] ?? [] as $definition) {
                $key = $definition['key'];
                if (($definition['scope'] ?? '') !== 'session' || array_key_exists($key, $metrics)) continue;
                $metrics[$key] = workout_number($m, $key, (float)$definition['min'], (float)$definition['max'], (bool)($definition['integer'] ?? false));
                if (($definition['required'] ?? false) && $metrics[$key] === null) throw new InvalidArgumentException('Enter '.$key);
            }
            if (isset($metrics['successes']) && (!isset($metrics['attempts']) || $metrics['successes'] > $metrics['attempts'])) {
                throw new InvalidArgumentException('Successful attempts require attempts and cannot exceed them');
            }
        }
        $clean[] = ['activityId' => $activity['id'], 'snapshot' => $activity, 'sets' => $sets, 'metrics' => $metrics];
    }
    return ['id'=>$data['id'], 'date'=>$data['date'], 'title'=>$title, 'style'=>$data['style'], 'notes'=>$notes, 'timezone'=>$timezone, 'items'=>$clean];
}

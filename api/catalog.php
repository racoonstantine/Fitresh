<?php
declare(strict_types=1);

function catalog_normalize(string $text): string {
    if (function_exists('iconv')) {
        $ascii = iconv('UTF-8', 'ASCII//TRANSLIT//IGNORE', $text);
        if ($ascii !== false) $text = $ascii;
    }
    return trim(preg_replace('/[^a-z0-9]+/', ' ', strtolower($text)) ?? '');
}

function catalog_load(?string $version = null): array {
    static $cache = [];
    if ($version === null) {
        $active = json_decode((string)file_get_contents(__DIR__ . '/catalog-active.json'), true, 512, JSON_THROW_ON_ERROR);
        $version = $active['version'];
    }
    if (!preg_match('/^[a-f0-9]{24}$/D', $version)) throw new InvalidArgumentException('Invalid catalog version');
    if (!isset($cache[$version])) {
        $path = __DIR__ . '/catalog-history/' . $version . '.json';
        if (!is_file($path)) throw new RuntimeException('Catalog version unavailable');
        $raw = (string)file_get_contents($path);
        if (substr(hash('sha256', $raw), 0, 24) !== $version) throw new RuntimeException('Catalog integrity check failed');
        $cache[$version] = json_decode($raw, true, 512, JSON_THROW_ON_ERROR);
    }
    return ['version' => $version, 'foods' => $cache[$version]['foods']];
}

function catalog_food(string $externalId): array {
    if (!preg_match('/^([a-f0-9]{24}):(FC[0-9]{6})$/D', $externalId, $match)) throw new InvalidArgumentException('Invalid catalog food');
    $catalog = catalog_load($match[1]);
    if (!isset($catalog['foods'][$match[2]])) throw new InvalidArgumentException('Unknown catalog food');
    $food = $catalog['foods'][$match[2]];
    unset($food['aliases']);
    $food['external_id'] = $externalId;
    return $food;
}

function catalog_search(string $query, int $limit = 30): array {
    $query = catalog_normalize($query);
    if (strlen($query) < 2 || strlen($query) > 120) return ['results'=>[], 'suggestions'=>[]];
    $catalog = catalog_load(); $results = []; $vocabulary = [];
    $tokens = explode(' ', $query);
    foreach ($catalog['foods'] as $id => $food) {
        $terms = array_map('catalog_normalize', array_merge([$food['name']], $food['aliases']));
        $allTokens = [];
        foreach ($terms as $term) {
            foreach (explode(' ', $term) as $token) {
                $allTokens[$token] = true;
                if (strlen($token) >= 5) $vocabulary[$token] = true;
            }
        }
        $matched = true;
        foreach ($tokens as $token) {
            if (!isset($allTokens[$token])) { $matched = false; break; }
        }
        if (!$matched) continue;
        $score = in_array($query, $terms, true) ? 100 : 50;
        if (catalog_normalize($food['name']) === $query) $score += 10;
        $result = catalog_food($catalog['version'] . ':' . $id);
        $result['matched_query'] = $query;
        $result['_score'] = $score;
        $results[] = $result;
    }
    usort($results, fn($a,$b) => ($b['_score'] <=> $a['_score']) ?: (strlen($a['name']) <=> strlen($b['name'])) ?: strcmp($a['name'],$b['name']));
    $total = count($results);
    $results = array_slice($results, 0, $limit);
    foreach ($results as &$r) unset($r['_score']);
    unset($r);
    $suggestions = [];
    // Suggest corrections only when there is no exact-token match. Never auto-select a food.
    if (!$results && count($tokens) === 1 && strlen($query) >= 5) {
        $distances=[]; $threshold = strlen($query)>=8 ? 2 : 1;
        foreach (array_keys($vocabulary) as $word) {
            if (abs(strlen($word)-strlen($query))>$threshold) continue;
            $distance=levenshtein($query,$word);
            if ($distance>0 && $distance<=$threshold) $distances[$word]=$distance;
        }
        asort($distances); $suggestions=array_slice(array_keys($distances),0,5);
    }
    return ['results'=>$results,'suggestions'=>$suggestions,'total'=>$total];
}

<?php
declare(strict_types=1);

function personal_foods_available(PDO $pdo): bool {
    try { $pdo->query('SELECT food_id FROM personal_food_versions LIMIT 0'); return true; }
    catch (PDOException $e) {
        if ($e->getCode() === '42S02' || str_contains($e->getMessage(), 'no such table')) return false;
        throw $e;
    }
}

function validate_personal_food(array $input): array {
    $text = function(string $key, int $max, bool $required = false) use ($input): string {
        $v = $input[$key] ?? '';
        if (!is_string($v) || !mb_check_encoding($v, 'UTF-8')) throw new InvalidArgumentException('Invalid '.$key.'.');
        $v = trim($v);
        if (($required && $v === '') || mb_strlen($v) > $max) throw new InvalidArgumentException('Check '.$key.' (maximum '.$max.' characters).');
        return $v;
    };
    $d = ['name'=>$text('name',200,true),'brand'=>$text('brand',150),'serving_label'=>$text('serving_label',80,true),
        'source_url'=>$text('source_url',2048),'notes'=>$text('notes',2000)];
    if ($d['source_url'] !== '' && (!filter_var($d['source_url'], FILTER_VALIDATE_URL) || !in_array(strtolower(parse_url($d['source_url'],PHP_URL_SCHEME) ?? ''),['http','https'],true))) throw new InvalidArgumentException('Use an http or https source link.');
    $measure = $input['serving_measure'] ?? 'serving';
    if (!in_array($measure,['serving','g','ml'],true)) throw new InvalidArgumentException('Select serving, g or ml.');
    $size = $measure === 'serving' ? 1.0 : filter_var($input['serving_size'] ?? null,FILTER_VALIDATE_FLOAT);
    if ($size === false || !is_finite($size) || $size < .01 || $size > 100000) throw new InvalidArgumentException('Serving size must be between 0.01 and 100000.');
    $d['serving_measure']=$measure;$d['serving_size']=$size;
    $raw = $input['nutrients'] ?? null;
    if (!is_array($raw)) throw new InvalidArgumentException('Enter nutrition per serving.');
    $d['nutrients']=[];
    foreach (['ENERC_KCAL','PROCNT','CHOCDF','FAT','FIBTG','SUGAR','NA','CHOLE'] as $code) {
        $v=$raw[$code] ?? null;
        if ($v === '' || $v === null) {
            // Calories is the only nutrient a food needs to be useful in the
            // log at all -- someone who just wants a quick calorie estimate
            // shouldn't have to fill in protein/carbs/fat they don't know.
            if ($code === 'ENERC_KCAL') throw new InvalidArgumentException('Calories is required. Enter 0 when the label states zero.');
            $d['nutrients'][$code]=null;continue;
        }
        if (is_bool($v) || !is_scalar($v)) throw new InvalidArgumentException('Invalid nutrient value.');
        $v=filter_var($v,FILTER_VALIDATE_FLOAT);
        if ($v === false || !is_finite($v) || $v<0 || $v>99999999 || ($measure!=='serving' && $v*100/$size>99999999)) throw new InvalidArgumentException('Nutrition values must be finite, nonnegative and within range.');
        $d['nutrients'][$code]=$v;
    }
    if ($d['nutrients']['SUGAR'] !== null && $d['nutrients']['CHOCDF'] !== null && $d['nutrients']['SUGAR']>$d['nutrients']['CHOCDF']+.1) throw new InvalidArgumentException('Sugar exceeds total carbohydrate. Check the label and serving basis.');
    return $d;
}

function personal_food_canonical(array $d): array {
    $factor=$d['serving_measure']==='serving' ? 1 : 100/$d['serving_size'];
    return ['canonical_amount'=>$d['serving_measure']==='serving' ? 1 : 100,'canonical_unit'=>$d['serving_measure'],
        'nutrients'=>array_map(fn($v)=>$v===null ? null : round($v*$factor,4),$d['nutrients'])];
}

function personal_food_metadata(PDO $pdo, int $id): ?array {
    $s=$pdo->prepare('SELECT v.*, s.status AS submission_status FROM personal_food_versions v LEFT JOIN food_submissions s ON s.food_id=v.food_id WHERE v.food_id=?');
    $s->execute([$id]);$r=$s->fetch(PDO::FETCH_ASSOC);
    if (!$r) return null;
    return ['food_id'=>(int)$r['food_id'],'root_food_id'=>(int)$r['root_food_id'],'revision'=>(int)$r['revision'],'is_current'=>(bool)$r['is_current'],
        'definition'=>json_decode($r['definition'],true),'submission_status'=>$r['submission_status'] ?? 'private'];
}

function save_personal_food(PDO $pdo, int $userId, array $input): array {
    $d=validate_personal_food($input);
    $key=$input['request_key'] ?? '';
    if (!is_string($key) || !preg_match('/^[a-f0-9-]{36}$/i',$key)) throw new InvalidArgumentException('Invalid save request ID.');
    $previous=filter_var($input['previous_food_id'] ?? 0,FILTER_VALIDATE_INT);
    if ($previous===false || $previous<0) throw new InvalidArgumentException('Invalid previous food.');
    $submit=$input['submit_for_review'] ?? false;
    if (!is_bool($submit)) throw new InvalidArgumentException('Invalid submission choice.');
    $hash=hash('sha256',json_encode([$d,$previous,$submit],JSON_THROW_ON_ERROR));
    $lock=$pdo->getAttribute(PDO::ATTR_DRIVER_NAME)==='mysql' ? ' FOR UPDATE' : '';
    $pdo->beginTransaction();
    try {
        $s=$pdo->prepare('SELECT food_id,request_hash FROM personal_food_versions WHERE owner_user_id=? AND request_key=?'.$lock);
        $s->execute([$userId,$key]);$existing=$s->fetch(PDO::FETCH_ASSOC);
        if ($existing) {
            if (!hash_equals($existing['request_hash'],$hash)) throw new InvalidArgumentException('This request ID was already used for different data.');
            $pdo->commit();return personal_food_metadata($pdo,(int)$existing['food_id']);
        }
        $root=0;$revision=1;
        if ($previous) {
            $s=$pdo->prepare('SELECT v.* FROM personal_food_versions v JOIN foods f ON f.id=v.food_id WHERE v.food_id=? AND v.owner_user_id=? AND f.owner_user_id=?'.$lock);
            $s->execute([$previous,$userId,$userId]);$old=$s->fetch(PDO::FETCH_ASSOC);
            if (!$old) throw new InvalidArgumentException('Personal food unavailable.');
            if (!(int)$old['is_current']) throw new DomainException('This food has a newer version. Reload your library before editing.');
            $root=(int)$old['root_food_id'];$revision=(int)$old['revision']+1;
            $pdo->prepare('UPDATE personal_food_versions SET is_current=0 WHERE food_id=?')->execute([$previous]);
        }
        $canonical=personal_food_canonical($d);
        $s=$pdo->prepare("INSERT INTO foods (owner_user_id,source,external_id,name,brand,canonical_amount,canonical_unit,created_at,updated_at) VALUES (?,'personal',?,?,?,?,?,CURRENT_TIMESTAMP,CURRENT_TIMESTAMP)");
        $s->execute([$userId,'pf:'.$userId.':'.$key,$d['name'],$d['brand'] ?: null,$canonical['canonical_amount'],$canonical['canonical_unit']]);
        $id=(int)$pdo->lastInsertId();
        $ids=[];foreach($pdo->query('SELECT id,code FROM nutrients') as $n)$ids[$n['code']]=$n['id'];
        $s=$pdo->prepare('INSERT INTO food_nutrients (food_id,nutrient_id,value_per_canonical) VALUES (?,?,?)');
        foreach($canonical['nutrients'] as $code=>$v)if($v!==null) {
            if (!isset($ids[$code])) throw new RuntimeException('Nutrient schema missing.');
            $s->execute([$id,$ids[$code],$v]);
        }
        $snapshot=json_encode($d,JSON_THROW_ON_ERROR);
        $pdo->prepare('INSERT INTO personal_food_versions (food_id,owner_user_id,root_food_id,revision,is_current,definition,request_key,request_hash) VALUES (?,?,?,?,1,?,?,?)')->execute([$id,$userId,$root ?: $id,$revision,$snapshot,$key,$hash]);
        if ($submit) $pdo->prepare("INSERT INTO food_submissions (food_id,owner_user_id,snapshot,status) VALUES (?,?,?,'pending')")->execute([$id,$userId,$snapshot]);
        $pdo->commit();return personal_food_metadata($pdo,$id);
    } catch (Throwable $e) { if($pdo->inTransaction())$pdo->rollBack();throw $e; }
}

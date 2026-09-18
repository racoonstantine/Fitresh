<?php
require __DIR__.'/../api/workout_validation.php';
function check($condition, $message) { if (!$condition) throw new RuntimeException($message); }
$catalog = [
 's'=>['id'=>'s','tracking'=>'load'], 'b'=>['id'=>'b','tracking'=>'reps'],
 'h'=>['id'=>'h','tracking'=>'hold'], 'c'=>['id'=>'c','tracking'=>'session']
];
$base=['id'=>'01234567-0123-4123-8123-0123456789ab','date'=>'2026-09-17','title'=>'Workout','style'=>'straight','timezone'=>'Asia/Taipei','items'=>[['activityId'=>'s','sets'=>[['reps'=>12,'weightKg'=>20],['reps'=>10,'weightKg'=>22],['reps'=>8,'weightKg'=>24]]]]];
$result=validate_workout($base,$catalog);
$volume=array_reduce($result['items'][0]['sets'],fn($total,$s)=>$total+$s['reps']*$s['weightKg'],0);
check($volume===652.0,'Per-set volume must use each actual load');
function rejects($data,$catalog) { try { validate_workout($data,$catalog); } catch (InvalidArgumentException $e) { return; } throw new RuntimeException('Expected rejection'); }
foreach (['2026-02-30','yesterday','2026-9-1'] as $date) rejects(array_replace($base,['date'=>$date]),$catalog);
foreach ([-1, 'oops', INF, 3000] as $weight) { $v=$base;$v['items'][0]['sets'][0]['weightKg']=$weight;rejects($v,$catalog); }
foreach ([null,0,1.5,10001] as $reps) { $v=$base;$v['items'][0]['sets'][0]['reps']=$reps;rejects($v,$catalog); }
rejects(array_replace($base,['items'=>[]]),$catalog);
rejects(array_replace($base,['items'=>[['activityId'=>'unknown']]]),$catalog);
rejects(array_replace($base,['timezone'=>'bogus']),$catalog);
$cardio=array_replace($base,['items'=>[['activityId'=>'c','metrics'=>['durationSeconds'=>1800]]]]);
$r=validate_workout($cardio,$catalog);check($r['items'][0]['metrics']['distanceKm']===null,'Unknown distance must remain null');
unset($cardio['items'][0]['metrics']['durationSeconds']);rejects($cardio,$catalog);
$hold=array_replace($base,['items'=>[['activityId'=>'h','sets'=>[['durationSeconds'=>30]]]]]);
check(validate_workout($hold,$catalog)['items'][0]['sets'][0]['reps']===null,'Timed sets are not repetitions');
$body=array_replace($base,['items'=>[['activityId'=>'b','sets'=>[['reps'=>10,'weightKg'=>80]]]]]);
check(validate_workout($body,$catalog)['items'][0]['sets'][0]['weightKg']===null,'Do not count body mass as load');
echo "PASS: volume, dates, ranges, required values, null metrics, timed sets, and bodyweight handling.\n";
$expanded=json_decode(file_get_contents(__DIR__.'/../data/workouts/catalog.json'),true);
$lookup=[];
foreach($expanded['activities'] as $a) $lookup[$a['id']]=$a;
$sport=array_replace($base,['items'=>[['activityId'=>'basketball-shooting','metrics'=>['durationSeconds'=>1200,'attempts'=>50,'successes'=>30]]]]);
$validated=validate_workout($sport,$lookup);
check($validated['items'][0]['metrics']['successes']===30.0,'Preserve sport-specific fields');
$sport['items'][0]['metrics']['successes']=51;rejects($sport,$lookup);
$sport['items'][0]['metrics']['successes']=1.5;rejects($sport,$lookup);
unset($sport['items'][0]['metrics']['attempts']);$sport['items'][0]['metrics']['successes']=1;rejects($sport,$lookup);
foreach($lookup as $a){
 $i=['activityId'=>$a['id']];
 if($a['tracking']==='session'){
  $i['metrics']=['durationSeconds'=>600];
  foreach($a['measurements'] as $m)if(!isset($i['metrics'][$m['key']]))$i['metrics'][$m['key']]=max(1,$m['min']);
 }else{$i['sets']=[['reps'=>10,'weightKg'=>5,'durationSeconds'=>20]];}
 $r=validate_workout(array_replace($base,['items'=>[$i]]),$lookup);
 check($r['items'][0]['activityId']===$a['id'],'Catalog activity validates');
 if($a['tracking']==='session')foreach($i['metrics'] as $k=>$v)check($r['items'][0]['metrics'][$k]===$v*1.0,'Preserve '.$k);
}
echo "PASS: all expanded activities validate and all declared session measurements survive normalization.\n";

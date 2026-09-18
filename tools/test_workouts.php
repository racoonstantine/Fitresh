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

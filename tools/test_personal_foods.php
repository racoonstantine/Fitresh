<?php
declare(strict_types=1);
require __DIR__.'/../api/personal_foods_store.php';
require __DIR__.'/../api/food_measurements.php';
function check(bool $ok,string $message): void {if(!$ok)throw new RuntimeException($message);}
function fails(callable $f,string $message): void {try{$f();}catch(InvalidArgumentException|DomainException $e){return;}throw new RuntimeException($message);}
$pdo=new PDO('sqlite::memory:',null,null,[PDO::ATTR_ERRMODE=>PDO::ERRMODE_EXCEPTION,PDO::ATTR_DEFAULT_FETCH_MODE=>PDO::FETCH_ASSOC]);
$pdo->exec("CREATE TABLE foods(id INTEGER PRIMARY KEY AUTOINCREMENT,owner_user_id INTEGER,source TEXT,external_id TEXT UNIQUE,name TEXT,brand TEXT,canonical_amount NUMERIC,canonical_unit TEXT,created_at TEXT,updated_at TEXT);
CREATE TABLE nutrients(id INTEGER PRIMARY KEY,code TEXT);
CREATE TABLE food_nutrients(food_id INTEGER,nutrient_id INTEGER,value_per_canonical NUMERIC,PRIMARY KEY(food_id,nutrient_id));
CREATE TABLE personal_food_versions(food_id INTEGER PRIMARY KEY,owner_user_id INTEGER,root_food_id INTEGER,revision INTEGER,is_current INTEGER,definition TEXT,request_key TEXT,request_hash TEXT,UNIQUE(owner_user_id,request_key),UNIQUE(root_food_id,revision));
CREATE TABLE food_submissions(id INTEGER PRIMARY KEY,food_id INTEGER UNIQUE,owner_user_id INTEGER,snapshot TEXT,status TEXT);
CREATE TABLE meal_components(food_id INTEGER,amount NUMERIC);");
foreach(['ENERC_KCAL','PROCNT','CHOCDF','FAT','FIBTG','SUGAR','NA','CHOLE'] as $i=>$code)$pdo->prepare('INSERT INTO nutrients VALUES (?,?)')->execute([$i+1,$code]);
$input=['name'=>'Test whey','brand'=>'Test brand','serving_label'=>'1 scoop','serving_measure'=>'g','serving_size'=>30,'source_url'=>'https://example.com/label','notes'=>'Label, chocolate',
 'nutrients'=>['ENERC_KCAL'=>120,'PROCNT'=>24,'CHOCDF'=>3,'FAT'=>1,'SUGAR'=>0,'NA'=>null], 'request_key'=>'11111111-1111-4111-8111-111111111111','submit_for_review'=>false];
$first=save_personal_food($pdo,1,$input);$id=$first['food_id'];
check($first['definition']['nutrients']['NA']===null,'Unknown sodium preserved');
check($first['definition']['nutrients']['SUGAR']!==null && (float)$first['definition']['nutrients']['SUGAR']===0.0,'Explicit zero preserved');
check((int)$pdo->query('SELECT COUNT(*) FROM food_submissions')->fetchColumn()===0,'Private save must not submit');
$food=$pdo->query('SELECT * FROM foods')->fetch();$food['personal_food']=$first;
check((float)$pdo->query('SELECT value_per_canonical FROM food_nutrients WHERE nutrient_id=1')->fetchColumn()===400.0,'120/30g must normalize to 400/100g');
check(food_measurement($food,['amount'=>2,'unit'=>'serving'])['amount']===60.0,'Two scoops should be 60g');
check(meal_food_measurement($pdo,$id,1,['amount'=>2,'unit'=>'serving'])['amount']===60.0,'Server loads trusted serving definition');
fails(fn()=>meal_food_measurement($pdo,$id,2,['amount'=>1,'unit'=>'g']),'Another owner must not log this food');
fails(fn()=>food_measurement($food,['amount'=>1,'unit'=>'ml']),'No implicit g/ml density');
$retry=save_personal_food($pdo,1,$input);check($retry['food_id']===$id,'Retry must reuse version');
fails(fn()=>save_personal_food($pdo,1,array_replace($input,['name'=>'Different'])),'Request key must bind to content');
$pdo->prepare('INSERT INTO meal_components VALUES (?,?)')->execute([$id,60]);
$before=$pdo->query('SELECT n.value_per_canonical*m.amount/f.canonical_amount FROM meal_components m JOIN foods f ON f.id=m.food_id JOIN food_nutrients n ON n.food_id=f.id WHERE n.nutrient_id=1')->fetchColumn();
$edit=array_replace($input,['previous_food_id'=>$id,'request_key'=>'22222222-2222-4222-8222-222222222222','submit_for_review'=>true]);$edit['nutrients']['ENERC_KCAL']=150;
fails(fn()=>save_personal_food($pdo,2,$edit),'Cannot edit another owner food');
$second=save_personal_food($pdo,1,$edit);
check($second['revision']===2 && $second['food_id']!==$id,'Edit must create new immutable revision');
check(!personal_food_metadata($pdo,$id)['is_current'],'Old revision hidden from current library');
$after=$pdo->query('SELECT n.value_per_canonical*m.amount/f.canonical_amount FROM meal_components m JOIN foods f ON f.id=m.food_id JOIN food_nutrients n ON n.food_id=f.id WHERE n.nutrient_id=1')->fetchColumn();
check((float)$before===240.0 && $before===$after,'Past meal calories must remain unchanged');
check($second['submission_status']==='pending','Opt-in creates pending review');
$snapshot=$pdo->query('SELECT snapshot FROM food_submissions')->fetchColumn();
$third=array_replace($edit,['previous_food_id'=>$second['food_id'],'request_key'=>'33333333-3333-4333-8333-333333333333','submit_for_review'=>false]);$third['name']='Revised name';
save_personal_food($pdo,1,$third);check($pdo->query('SELECT snapshot FROM food_submissions')->fetchColumn()===$snapshot,'Queue snapshot must not change with later edits');
$stale=array_replace($edit,['request_key'=>'44444444-4444-4444-8444-444444444444']);
fails(fn()=>save_personal_food($pdo,1,$stale),'Stale edit must be rejected');
check((int)$pdo->query('SELECT COUNT(*) FROM foods')->fetchColumn()===3,'Rejected edits must leave no partial food');
foreach([['serving_size'=>0],['serving_size'=>-1],['serving_measure'=>'oz'],['source_url'=>'javascript:alert(1)'],['name'=>str_repeat('a',201)]] as $bad)fails(fn()=>validate_personal_food(array_replace($input,$bad)),'Invalid fields accepted');
// PROCNT is optional now -- null must be accepted (unknown protein), but
// still-invalid values (negative/non-finite/wrong type) must still fail.
$v=$input;$v['nutrients']['PROCNT']=null;check(validate_personal_food($v)['nutrients']['PROCNT']===null,'Optional nutrient left blank must be accepted');
foreach([-1,INF,NAN,true,[]] as $bad){$v=$input;$v['nutrients']['PROCNT']=$bad;fails(fn()=>validate_personal_food($v),'Invalid nutrient accepted');}
// Calories is still the one required nutrient.
$v=$input;$v['nutrients']['ENERC_KCAL']=null;fails(fn()=>validate_personal_food($v),'Missing calories must still be rejected');
$v=$input;$v['nutrients']['SUGAR']=10;fails(fn()=>validate_personal_food($v),'Sugar/carbohydrate inconsistency accepted');
$v=$input;$v['serving_measure']='serving';unset($v['serving_size']);$d=validate_personal_food($v);check(personal_food_canonical($d)['canonical_amount']===1,'Unknown weight stays one serving');
$v=$input;$v['serving_measure']='ml';$v['serving_size']=250;$d=validate_personal_food($v);$ml=personal_food_canonical($d);check($ml['nutrients']['ENERC_KCAL']===48.0,'Volume normalization');
check(food_measurement(array_merge($ml,['source'=>'personal','personal_food'=>['definition'=>$d]]),['amount'=>2,'unit'=>'serving'])['amount']===500.0,'Two volume servings');
echo "PASS: private ownership, normalization, serving conversions, unknown vs zero, immutable edits/logs, review snapshots, retry idempotency, stale edits and validation (SQLite integration).\n";

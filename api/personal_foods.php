<?php
declare(strict_types=1);
require __DIR__.'/db.php';
require __DIR__.'/personal_foods_store.php';
start_app_session();
if (empty($_SESSION['user_id'])) json_respond(['error'=>'Not logged in'],401);
$userId=(int)$_SESSION['user_id'];
$method=$_SERVER['REQUEST_METHOD'];
if (!in_array($method,['GET','POST'],true)) json_respond(['error'=>'Method not allowed'],405);
try {
    $pdo=get_db();
    if (!personal_foods_available($pdo)) json_respond(['error'=>'Personal foods are awaiting database setup. Please try again after the update.'],503);
    $_SESSION['personal_food_csrf'] ??= bin2hex(random_bytes(32));
    if ($method==='GET') {
        $s=$pdo->prepare('SELECT food_id FROM personal_food_versions WHERE owner_user_id=? AND is_current=1 ORDER BY food_id DESC LIMIT 200');
        $s->execute([$userId]);
        json_respond(['csrf_token'=>$_SESSION['personal_food_csrf'],'foods'=>array_map(fn($r)=>personal_food_metadata($pdo,(int)$r['food_id']),$s->fetchAll())]);
    }
    require_json_request();
    if (!hash_equals($_SESSION['personal_food_csrf'],(string)($_SERVER['HTTP_X_CSRF_TOKEN'] ?? ''))) json_respond(['error'=>'Reload the form and try again.'],403);
    $raw=file_get_contents('php://input',false,null,0,16385);
    if (strlen($raw)>16384) json_respond(['error'=>'Request too large'],413);
    $input=json_decode($raw,true);
    if (!is_array($input)) json_respond(['error'=>'Invalid JSON'],400);
    json_respond(['food'=>save_personal_food($pdo,$userId,$input)]);
} catch (DomainException $e) { json_respond(['error'=>$e->getMessage()],409); }
catch (InvalidArgumentException $e) { json_respond(['error'=>$e->getMessage()],400); }
catch (Throwable $e) { error_log('Personal food operation failed: '.$e->getMessage());json_respond(['error'=>'Could not save or load personal foods. Please retry.'],503); }

<?php
declare(strict_types=1);
require __DIR__ . '/db.php';
require __DIR__ . '/workout_validation.php';
start_app_session();
if (empty($_SESSION['user_id'])) json_respond(['error'=>'Not logged in'], 401);
$userId = (int)$_SESSION['user_id'];
$method = $_SERVER['REQUEST_METHOD'];
if (!in_array($method, ['GET','POST'], true)) json_respond(['error'=>'Method not allowed'],405);
require_json_request();
try {
    $pdo = get_db();
    $catalog = [];
    foreach ($pdo->query('SELECT definition FROM workout_activities') as $row) {
        $a = json_decode($row['definition'], true); $catalog[$a['id']] = $a;
    }
    if ($method === 'GET') {
        $templates = [];
        foreach ($pdo->query('SELECT definition FROM workout_templates ORDER BY id') as $row) $templates[] = json_decode($row['definition'], true);
        $stmt = $pdo->prepare('SELECT * FROM workout_sessions WHERE user_id = ? ORDER BY session_date DESC, created_at DESC LIMIT 200');
        $stmt->execute([$userId]); $sessions = $stmt->fetchAll();
        $items = $pdo->prepare('SELECT * FROM workout_session_items WHERE session_id = ? ORDER BY position');
        $sets = $pdo->prepare('SELECT reps, weight_kg AS weightKg, duration_seconds AS durationSeconds FROM workout_sets WHERE item_id = ? ORDER BY position');
        foreach ($sessions as &$session) {
            $session['date'] = $session['session_date'];
            $items->execute([$session['id']]); $session['items'] = [];
            foreach ($items->fetchAll() as $item) {
                $sets->execute([$item['id']]);
                $session['items'][] = ['activityId'=>$item['activity_id'], 'snapshot'=>json_decode($item['snapshot'],true), 'metrics'=>json_decode($item['metrics'],true), 'sets'=>$sets->fetchAll()];
            }
        }
        unset($session);
        json_respond(['activities'=>array_values($catalog),'templates'=>$templates,'sessions'=>$sessions]);
    }
    $raw = file_get_contents('php://input', false, null, 0, 262145);
    if (strlen($raw) > 262144) json_respond(['error'=>'Request too large'],413);
    $input = json_decode($raw, true);
    if (!is_array($input)) json_respond(['error'=>'Invalid JSON'],400);
    $action = $input['action'] ?? 'save';
    if ($action === 'delete') {
        $stmt = $pdo->prepare('DELETE FROM workout_sessions WHERE id = ? AND user_id = ?');
        $stmt->execute([(string)($input['id'] ?? ''),$userId]);
        json_respond(['ok'=>true]);
    }
    if ($action !== 'save') json_respond(['error'=>'Unknown action'],400);
    $w = validate_workout($input, $catalog);
    $pdo->beginTransaction();
    // Insert-or-lock makes a retry with the same ID idempotent. Ownership is checked before edits.
    $stmt = $pdo->prepare('INSERT INTO workout_sessions (id,user_id,session_date,title,style,notes,timezone,created_at) VALUES (?,?,?,?,?,?,?,NOW()) ON DUPLICATE KEY UPDATE id=id');
    $stmt->execute([$w['id'],$userId,$w['date'],$w['title'],$w['style'],$w['notes'],$w['timezone']]);
    $stmt = $pdo->prepare('SELECT user_id FROM workout_sessions WHERE id=? FOR UPDATE'); $stmt->execute([$w['id']]);
    if ((int)$stmt->fetchColumn() !== $userId) { $pdo->rollBack(); json_respond(['error'=>'Session unavailable'],403); }
    $stmt = $pdo->prepare('UPDATE workout_sessions SET session_date=?,title=?,style=?,notes=?,timezone=? WHERE id=? AND user_id=?');
    $stmt->execute([$w['date'],$w['title'],$w['style'],$w['notes'],$w['timezone'],$w['id'],$userId]);
    $pdo->prepare('DELETE FROM workout_session_items WHERE session_id=?')->execute([$w['id']]);
    $insertItem = $pdo->prepare('INSERT INTO workout_session_items (session_id,position,activity_id,snapshot,metrics) VALUES (?,?,?,?,?)');
    $insertSet = $pdo->prepare('INSERT INTO workout_sets (item_id,position,reps,weight_kg,duration_seconds) VALUES (?,?,?,?,?)');
    foreach ($w['items'] as $i=>$item) {
        $insertItem->execute([$w['id'],$i,$item['activityId'],json_encode($item['snapshot']),json_encode($item['metrics'])]);
        $itemId = $pdo->lastInsertId();
        foreach ($item['sets'] as $j=>$set) $insertSet->execute([$itemId,$j,$set['reps'],$set['weightKg'],$set['durationSeconds']]);
    }
    $pdo->commit(); json_respond(['ok'=>true,'id'=>$w['id']]);
} catch (InvalidArgumentException $e) {
    json_respond(['error'=>$e->getMessage()],400);
} catch (Throwable $e) {
    if (isset($pdo) && $pdo->inTransaction()) $pdo->rollBack();
    error_log('Workout API: '.$e->getMessage());
    json_respond(['error'=>'Workout storage is unavailable. Check that migration 004 and the workout seed have been installed.'],503);
}

<?php
declare(strict_types=1);
// Operator-only CLI; no public endpoint and no automatic catalog publication.
if (PHP_SAPI!=='cli') {http_response_code(404);exit;}
require __DIR__.'/../api/db.php';
$action=$argv[1] ?? 'list';
if (!in_array($action,['list','show','review'],true)) {fwrite(STDERR,"Use list, show ID, or review ID ready_for_curation|needs_evidence|rejected NOTE\n");exit(2);}
$pdo=get_db();
if($action==='list') {
    $rows=$pdo->query("SELECT id,food_id,status,created_at FROM food_submissions WHERE status IN ('pending','needs_evidence','ready_for_curation') ORDER BY id LIMIT 200")->fetchAll();
    echo json_encode($rows,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)."\n";exit;
}
$id=filter_var($argv[2] ?? null,FILTER_VALIDATE_INT);
if(!$id || $id<1){fwrite(STDERR,"Positive submission ID required.\n");exit(2);}
if($action==='review') {
    $status=$argv[3] ?? '';$note=trim($argv[4] ?? '');
    if(!in_array($status,['ready_for_curation','needs_evidence','rejected'],true) || $note==='' || strlen($note)>4000){fwrite(STDERR,"Choose a review status and supply a note (up to 4000 bytes).\n");exit(2);}
    $stmt=$pdo->prepare('UPDATE food_submissions SET status=?,review_note=?,reviewed_at=CURRENT_TIMESTAMP WHERE id=?');$stmt->execute([$status,$note,$id]);
}
$stmt=$pdo->prepare('SELECT * FROM food_submissions WHERE id=?');$stmt->execute([$id]);$row=$stmt->fetch();
if(!$row){fwrite(STDERR,"Submission not found.\n");exit(2);}
$row['snapshot']=json_decode($row['snapshot'],true);
echo json_encode($row,JSON_PRETTY_PRINT|JSON_UNESCAPED_UNICODE)."\n";

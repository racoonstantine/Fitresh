<?php
declare(strict_types=1);
require __DIR__.'/../api/catalog.php';
function ensure(bool $ok,string $message):void {if(!$ok)throw new RuntimeException($message);}
foreach(['kfc','mang inasal','starbucks','skyflakes','maling'] as $term){
    ensure(catalog_search($term)['results']===[],'Estimates leaked into default: '.$term);
    $rows=catalog_search($term,100,true)['results'];ensure(count($rows)>0,'Missing opt-in '.$term);
    foreach($rows as $r){
        ensure($r['label']==='Estimated','Missing estimated label');
        ensure($r['confidence']['level']==='Low','Missing low confidence');
        ensure(!empty($r['estimate']['assumptions']),'Missing assumptions');
        $saved=catalog_food($r['external_id']);
        ensure($saved['estimate']===$r['estimate'] && $saved['nutrients']===$r['nutrients'],'Saved estimate snapshot drift');
        ensure($saved['portions']===[],'Invented restaurant serving');
    }
}
ensure(catalog_search('cobra',30,true)['results']===[],'Incomplete energy-drink model should remain validator-only');
// Old snapshots are still loadable with no estimate collection.
$old=catalog_load('491cd9c83ec97255ba0647b5');ensure($old['estimate_foods']===[],'Old snapshot changed');
echo "PASS: default exclusion, explicit opt-in, labels, assumptions, persisted nutrition, old snapshots, incomplete estimates.\n";

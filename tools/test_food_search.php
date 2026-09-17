<?php
declare(strict_types=1);
require __DIR__ . '/../api/catalog.php';
function check(bool $ok,string $message):void { if (!$ok) throw new RuntimeException($message); }
function names(string $query):array { return array_column(catalog_search($query)['results'],'name'); }
$sayote=names('sayote');
check(in_array('Chayote',$sayote,true),'Sayote must find fruit');
check(in_array('Chayote fruit, boiled',$sayote,true),'Sayote must find boiled fruit');
check(in_array('Chayote lvs, boiled',$sayote,true),'Sayote must show cataloged leaves separately');
check(names(' SAYOTE!! ')===$sayote,'Case/space/punctuation normalization');
check(names('sayote boiled')!==[],'Mixed Filipino/English qualifiers');
foreach(names('sayote boiled') as $name) check(str_contains($name,'boiled'),'Boiled query must preserve preparation');
check(names('talong')!==[],'Talong lookup');
check(names('munggo')===names('monggo'),'Munggo/monggo equivalence');
check(names('malunggay')!==[],'Malunggay lookup');
foreach(names('bataw') as $name) check(str_contains($name,'Hyacinth'),'Bataw must not match sitaw');
foreach(names('sitaw') as $name) check(!str_contains($name,'Hyacinth'),'Sitaw must not match bataw');
$typo=catalog_search('sayotte');
check($typo['results']===[],'Typos must not silently select foods');
check(in_array('sayote',$typo['suggestions'],true),'Typo suggestion');
check(names('giniling na baka')!==[],'Broad native parent should find explicit ground-beef variants');
$all=catalog_load();
foreach($all['foods'] as $id=>$food){
    $saved=catalog_food($all['version'].':'.$id);
    check($saved['nutrients']===$food['nutrients'],'Server-selected values retained');
    check($saved['nutrient_provenance']===$food['nutrient_provenance'],'Provenance retained');
    check(strlen($saved['name'])<=200,'Food fits database name field');
    check($saved['label']!=='Estimated','No estimates enabled by alias search');
}
foreach(['../../bad:FC000001',$all['version'].':FC999999'] as $bad){
    try{catalog_food($bad);throw new RuntimeException('Accepted invalid ID');}
    catch(InvalidArgumentException $e){}
}
echo 'PASS: aliases, qualifiers, collisions, typo suggestions, variant discovery, immutable values and provenance for '.count($all['foods'])." searchable foods.\n";

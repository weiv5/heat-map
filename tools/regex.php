<?php
$pattern = '|<path[\s\S]*?[\s]d=\"(.*?)\"[\s\S]*?/>|';

$path = "./new_svg";

$dir = opendir($path);
while ($d = readdir($dir)) {
    if ($d == "." || $d == "..") {
        continue;
    }
    
    $file = $path."/".$d;
    $content = file_get_contents($file);
    preg_match_all($pattern, $content, $list);
    $ret = array();
    var_dump("--------------------------------------- {$d} -----------------------------------------------------");
    foreach ($list[1] as $val)
    {
        $ret[]["path"] = $val;
    }
    var_dump(json_encode($ret));
}
closedir($dir);

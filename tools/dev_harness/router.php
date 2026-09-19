<?php
// php -S router: /api/* is served from the harness's patched backend copy
// (HARNESS_API_DIR); everything else falls through to the repo's public/
// docroot, so front-end edits show up live with no rebuild.
$apiDir = getenv('HARNESS_API_DIR');
$path = parse_url($_SERVER['REQUEST_URI'], PHP_URL_PATH) ?: '/';
if ($apiDir && str_starts_with($path, '/api/')) {
    $rel = substr($path, 5);
    if (preg_match('#^[A-Za-z0-9_]+\.php$#', $rel) && is_file("$apiDir/$rel")) {
        chdir($apiDir);
        $_SERVER['SCRIPT_NAME'] = $path;
        require "$apiDir/$rel";
        return true;
    }
    http_response_code(404);
    header('Content-Type: application/json');
    echo '{"error":"not found"}';
    return true;
}
return false;

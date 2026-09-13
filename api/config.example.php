<?php
/**
 * Copy this file to config.local.php on the SERVER ONLY (via cPanel File Manager
 * or SFTP) and fill in real values. config.local.php is gitignored and excluded
 * from the deploy pipeline on purpose — your DB password should never end up in
 * git history or GitHub Actions logs.
 */
return [
    'db_host' => 'localhost',
    'db_name' => 'cpanelusername_fitness',
    'db_user' => 'cpanelusername_fitness',
    'db_pass' => 'REPLACE_ME',
    // New signups land here for approval before they can log in.
    'admin_email' => 'you@example.com',
];

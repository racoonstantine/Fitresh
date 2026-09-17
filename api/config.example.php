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
    // Your real domain, used to build the approve/reject links in that
    // email. Set this instead of trusting the request's Host header, which
    // a client can send as anything it wants -- an unset/wrong value here
    // would let a forged Host header redirect your approval token to an
    // attacker's domain instead of this one.
    'app_host' => 'gedli.com',
];

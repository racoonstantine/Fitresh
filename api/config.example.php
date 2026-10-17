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
    'app_host' => 'fitresh.com',
    // Optional: turns on the one-tap "Ask AI" in AI Assist (food, workouts, watch stats, photos).
    // Create an API key at platform.openai.com (separate from a ChatGPT subscription) and set a
    // monthly spend limit there. Leave out to keep the copy/paste flow only.
    // 'openai_api_key' => 'sk-...',
    // 'openai_model' => 'gpt-4o-mini',   // must support images; gpt-4o is more accurate but costs more
    // 'openai_base_url' => 'https://api.openai.com/v1', // only change for a proxy or test server
    // 'ai_daily_limit' => 40,             // answered requests per user per day
    // 'ai_global_daily_limit' => 600,     // whole site per day: a cost backstop
    // Optional: folder for login session files (default: a fitresh_sessions folder above the web root).
    // 'session_path' => '/home/cpanelusername/fitresh_sessions',
];

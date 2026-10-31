<?php
declare(strict_types=1);
require __DIR__.'/../api/ai_assist_lib.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }

// Text keeps the old 45 s; each photo adds 10 s; capped at 75 s (browser gives up at 90 s).
check(ai_openai_timeout(0) === 45, 'text-only timeout unchanged');
check(ai_openai_timeout(1) === 55, 'one photo');
check(ai_openai_timeout(3) === 75, 'three photos reach the cap');
check(ai_openai_timeout(5) === 75, 'five photos stay capped');
check(ai_openai_timeout(-2) === 45, 'negative counts are treated as none');

echo "ai_assist_lib tests passed\n";

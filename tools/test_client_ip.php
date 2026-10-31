<?php
declare(strict_types=1);
require __DIR__.'/../api/security.php';
function check(bool $ok, string $message): void { if (!$ok) throw new RuntimeException($message); }
function ip_for(?string $remote, ?string $header): string
{
    unset($_SERVER['REMOTE_ADDR'], $_SERVER['HTTP_CF_CONNECTING_IP']);
    if ($remote !== null) $_SERVER['REMOTE_ADDR'] = $remote;
    if ($header !== null) $_SERVER['HTTP_CF_CONNECTING_IP'] = $header;
    return client_ip();
}

// Cloudflare edge + header -> the visitor's IP
check(ip_for('104.16.0.1', '203.0.113.7') === '203.0.113.7', 'Cloudflare IPv4 edge uses the header');
check(ip_for('172.71.255.254', '198.51.100.9') === '198.51.100.9', '172.64.0.0/13 upper edge matches');
check(ip_for('104.16.0.1', ' 203.0.113.7 ') === '203.0.113.7', 'Header is trimmed');
// Cloudflare edge without a header -> REMOTE_ADDR
check(ip_for('104.16.0.1', null) === '104.16.0.1', 'No header falls back to REMOTE_ADDR');

// Forged header from a non-Cloudflare source is ignored
check(ip_for('203.0.113.50', '1.2.3.4') === '203.0.113.50', 'Forged header from a normal client is ignored');
check(ip_for('104.15.255.255', '1.2.3.4') === '104.15.255.255', 'Just below 104.16.0.0/13 is not Cloudflare');
check(ip_for('104.24.0.1', '1.2.3.4') === '1.2.3.4', '104.24.0.0/14 is Cloudflare');
check(ip_for('104.28.0.1', '1.2.3.4') === '104.28.0.1', 'Just above 104.24.0.0/14 is not Cloudflare');
check(ip_for('2001:db8::1', '1.2.3.4') === '2001:db8::1', 'Forged header from a normal IPv6 client is ignored');

// Invalid header values are ignored
foreach (['not-an-ip', '', '1.2.3', '1.2.3.4, 5.6.7.8', '999.1.1.1', '1.2.3.4/32'] as $bad) {
    check(ip_for('104.16.0.1', $bad) === '104.16.0.1', "Invalid header '$bad' is ignored");
}

// IPv6
check(ip_for('2606:4700::1111', '2001:db8::42') === '2001:db8::42', 'Cloudflare IPv6 edge uses the header');
check(ip_for('2606:4700::1111', '203.0.113.7') === '203.0.113.7', 'IPv6 edge may carry an IPv4 visitor');
check(ip_for('2a06:98c7:ffff::1', '2001:db8::42') === '2001:db8::42', '/29 range matches inside');
check(ip_for('2a06:98c8::1', '2001:db8::42') === '2a06:98c8::1', '/29 range stops at its edge');
check(ip_for('2606:4701::1', '2001:db8::42') === '2606:4701::1', 'Neighbouring /32 is not Cloudflare');

// Without Cloudflare nothing changes
check(ip_for('198.51.100.20', null) === '198.51.100.20', 'Plain REMOTE_ADDR path unchanged');
check(ip_for(null, '203.0.113.7') === 'unknown', 'Missing REMOTE_ADDR stays unknown and ignores the header');

echo "client_ip tests passed\n";

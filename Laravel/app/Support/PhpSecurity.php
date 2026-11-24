<?php

namespace App\Support;

use Illuminate\Support\Facades\Log;
use Throwable;

/**
 * Is the PHP running this site one with known critical security holes?
 *
 * composer.json already refuses to install on one (`require.php`), but a site
 * can be installed with one PHP and run by another: a build image newer than
 * the server, or a server that was never updated. This says so at runtime.
 *
 * PATCHED is each branch's first release with the 19 Nov 2026 security fixes
 * (https://www.php.net/archive/2026.php#2026-11-19-1 and the three after it):
 * remote code execution through the session extension (CVE-2026-126714,
 * CVE-2026-115560, CVE-2026-129481), PHP-FPM request smuggling
 * (CVE-2026-129289), and use-after-free bugs in core and date
 * (CVE-2026-129474, CVE-2026-129182, CVE-2026-129496). They include October's
 * "PHP2Shell" fixes (CVE-2026-109618, CVE-2026-109619). Raise a floor here,
 * and in composer.json, when php.net ships the next security release.
 */
final class PhpSecurity
{
    /** Each supported branch's first patched release. */
    public const PATCHED = [
        '8.2' => '8.2.36',
        '8.3' => '8.3.37',
        '8.4' => '8.4.28',
        '8.5' => '8.5.13',
    ];

    /** When each branch stops getting security fixes from php.net. */
    public const END_OF_LIFE = [
        '8.2' => '2026-12-31',
        '8.3' => '2027-12-31',
        '8.4' => '2028-12-31',
        '8.5' => '2029-12-31',
    ];

    /**
     * What's wrong with this PHP, in a sentence, or null when nothing is known
     * to be. A branch newer than the table (8.6 and later) counts as fine.
     */
    public static function problem(?string $version = null, ?string $today = null): ?string
    {
        $version ??= PHP_VERSION;
        $today ??= date('Y-m-d');

        if (! preg_match('/^(\d+)\.(\d+)\.(\d+)/', $version, $m)) {
            return null;
        }
        $branch = "{$m[1]}.{$m[2]}";
        $current = "{$m[1]}.{$m[2]}.{$m[3]}";

        if (version_compare($branch, '8.2', '<')) {
            return "PHP {$current} no longer gets security fixes, and has known remote code execution holes. Move to PHP 8.4 or later.";
        }
        if (! isset(self::PATCHED[$branch])) {
            return null;
        }
        if (version_compare($current, self::PATCHED[$branch], '<')) {
            return "PHP {$current} has known critical security holes, including remote code execution (fixed 19 Nov 2026). Update to PHP ".self::PATCHED[$branch].' or later.';
        }
        if ($today > self::END_OF_LIFE[$branch]) {
            return "PHP {$branch} stopped getting security fixes on ".self::END_OF_LIFE[$branch].'. Move to PHP 8.4 or later.';
        }

        return null;
    }

    /**
     * Log the problem, at most once a day per PHP version. Never throws: a
     * warning about the server must not take the site down with it.
     */
    public static function warnOnce(): void
    {
        try {
            $problem = self::problem();
            if ($problem === null) {
                return;
            }
            $marker = storage_path('framework/php-security-'.PHP_VERSION);
            if (is_file($marker) && filemtime($marker) > time() - 86400) {
                return;
            }
            @touch($marker);
            Log::warning('[bd] '.$problem.' See README.md, "PHP version".');
        } catch (Throwable) {
            // Nowhere to say it; the setup banner still shows it locally.
        }
    }
}

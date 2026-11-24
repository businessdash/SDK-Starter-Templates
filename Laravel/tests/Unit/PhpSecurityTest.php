<?php

namespace Tests\Unit;

use App\Support\PhpSecurity;
use PHPUnit\Framework\TestCase;

class PhpSecurityTest extends TestCase
{
    public function test_each_branch_before_its_patch_is_flagged(): void
    {
        foreach (['8.2.35', '8.3.36', '8.4.27', '8.5.12', '8.4.0'] as $version) {
            $this->assertNotNull(PhpSecurity::problem($version, '2026-11-24'), $version);
        }
        $this->assertStringContainsString('8.4.28', PhpSecurity::problem('8.4.27', '2026-11-24'));
    }

    public function test_patched_releases_pass(): void
    {
        foreach (['8.2.36', '8.3.37', '8.4.28', '8.4.30', '8.5.13', '8.6.0', '9.0.1'] as $version) {
            $this->assertNull(PhpSecurity::problem($version, '2026-11-24'), $version);
        }
    }

    public function test_old_and_ended_branches_are_flagged(): void
    {
        $this->assertStringContainsString('no longer gets security fixes', PhpSecurity::problem('8.1.34', '2026-11-24'));
        $this->assertNull(PhpSecurity::problem('8.2.36', '2026-12-31'));
        $this->assertStringContainsString('stopped getting security fixes', PhpSecurity::problem('8.2.36', '2027-01-01'));
    }

    public function test_build_suffixes_are_read(): void
    {
        $this->assertNull(PhpSecurity::problem('8.4.28-1+ubuntu24.04.1+deb.sury.org+1', '2026-11-24'));
        $this->assertNotNull(PhpSecurity::problem('8.3.36-dev', '2026-11-24'));
        $this->assertNull(PhpSecurity::problem('nonsense', '2026-11-24'));
    }
}

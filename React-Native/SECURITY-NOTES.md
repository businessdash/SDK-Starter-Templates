# Security notes

## `image-size` — GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq (resolved)

Dependabot reported two high-severity advisories against `image-size@1.2.1`:
infinite loops in its ICNS, JXL and HEIF parsers (availability only). There was
no patched release, and every Metro through 0.83 pinned `image-size: ^1.0.2`, so
the alerts were accepted on 2026-09-08 as a build-time-only risk.

The Expo SDK 58 upgrade (2026-11-19) brings Metro 0.87, which no longer depends
on `image-size` at all. It is absent from `pnpm-lock.yaml`, so both alerts close
with this lockfile. If they reappear, run `pnpm why image-size` to see what
brought it back before accepting them again.

## `zod` — GHSA-mrhx-c7xc-m3w5 (open)

`zod` 3 is a dev dependency here because the published `@businessdash/sdk`
still depends on zod 3. It moves to zod 4 when the SDK publishes its zod 4
build; until then `pnpm audit` reports this one finding.

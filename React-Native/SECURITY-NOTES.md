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

## `zod` — GHSA-mrhx-c7xc-m3w5 (resolved)

Zod 3 collects one issue per failing element of an array with no length limit,
so a large enough request runs the process out of memory. The fix exists only
in zod 4.6.6 and later. Zod 3 was here because `@businessdash/sdk` depended on
it through 0.9.90. This starter now pins SDK 0.9.91, which is built on zod 4,
and zod `^4.6.7` itself, so no zod 3 is left in `pnpm-lock.yaml`. If the
finding comes back, run `pnpm why zod` to see what brought zod 3 back.

# Security notes

## `image-size` — GHSA-w3rx-r6r6-pgpr, GHSA-5p2g-fcmc-qvqq

Dependabot reports two high-severity advisories against `image-size@1.2.1` in
this template's lockfile. Both are accepted, not fixed, and this is the record
of why — so the next person to see the alerts does not repeat the analysis.

**What they are.** Infinite loops in the ICNS parser and in the JXL/HEIF
parsers. Availability only: `CVSS:3.1/AV:N/AC:L/PR:N/UI:N/S:U/C:N/I:N/A:H` — no
confidentiality or integrity impact. Feed the parser a malformed image of one of
those types and it spins.

**Why there is no upgrade.** There is no patched version. `image-size` publishes
up to 2.0.2 and the advisory range is `<= 2.0.2`, so the newest release is
affected too. The dependency arrives through Metro, and every Metro release
through 0.83.0 pins `image-size: ^1.0.2`, so upgrading React Native does not
move it either. A `pnpm.overrides` pin would only exchange one affected version
for another.

**Why it is accepted.**

- It is a **build-time** dependency. Metro reads image dimensions while
  bundling; nothing here runs at app runtime and nothing ships to a device.
- This template is **not a workspace member** of the monorepo, so it is not
  installed by BusinessDash's own build at all. It exists to be copied.
- Reaching the parser means putting a hostile `.icns`, `.jxl` or `.heif` file
  into your own project's assets and then bundling it. An attacker who can write
  to your asset folder has better options than making your bundler hang.

**What would change this.** A patched `image-size`, or a Metro release that
drops it. Either makes this a one-line lockfile bump — check both before
dismissing the alerts again.

Reviewed 2026-09-08.

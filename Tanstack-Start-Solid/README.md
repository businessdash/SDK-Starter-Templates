# BusinessDash SDK — TanStack Start starter

TanStack Start with **Solid**, in two versions side by side:

| Folder | Solid | TanStack Router / Start | Use it when |
| --- | --- | --- | --- |
| [`solid/`](./solid/README.md) | **2.0.3+** | 2.0 release candidate (`rc.10`) | You're starting fresh, or your app is on Solid 2 |
| [`solid-1/`](./solid-1/README.md) | **1.9** | 1.x | Your app is still on Solid 1 |

Both have the same pages, the same `.env` and the same BusinessDash features.
The nesting keeps each one's lockfile and `node_modules` to itself (and leaves
room for a React variant beside them).

```sh
cd solid          # or: cd solid-1
pnpm install --ignore-workspace
cp .env.example .env.local   # then fill in the three BD_* variables
pnpm dev
```

> `--ignore-workspace` matters. This repo has a pnpm workspace at its root, and
> a plain `pnpm install` from inside a starter walks up, finds it, and installs
> **that** instead — leaving the starter's own dependency versions untouched
> while appearing to succeed.

Each folder's README covers setup, environment variables, schema sync, seeding
and CRUD. [`solid/README.md`](./solid/README.md) also lists exactly what differs
between the two versions and why.

## Solid version

**`solid/` is Solid 2.** Two things are pinned there on purpose:

- **TanStack Router and Start at `2.0.0-rc.10`.** Their Solid 2 support is still
  a release candidate, and `rc.11` imports an export no published
  `@tanstack/start-server-core` has, so its server build fails.
- **No Form or Store demo.** `@tanstack/solid-form` and `@tanstack/solid-store`
  have no Solid 2 build yet. `solid-1/` still has both demos.

**`solid-1/` is Solid 1.9**, unchanged from before the move, and it stays
maintained alongside.

The SDK's Solid binding (`@businessdash/sdk/solid`) supports both majors from
one import. On Solid 2 it needs SDK 0.9.91 or later: on 0.9.90, `<BdForm>`
throws on Solid 2.

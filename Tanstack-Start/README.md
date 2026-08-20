# BusinessDash SDK — TanStack Start starter

The project lives one level down, in [`solid/`](./solid/README.md) — TanStack
Start with **Solid**.

The nesting leaves room for a React variant beside it without either one's
lockfile or `node_modules` leaking into the other.

```sh
cd solid
pnpm install --ignore-workspace
cp .env.example .env.local   # then fill in the three BIAB_* variables
pnpm dev
```

> `--ignore-workspace` matters. This repo has a pnpm workspace at its root, and
> a plain `pnpm install` from inside a starter walks up, finds it, and installs
> **that** instead — leaving the starter's own dependency versions untouched
> while appearing to succeed.

See [`solid/README.md`](./solid/README.md) for setup, environment variables,
schema sync, seeding and CRUD.

## Solid version

Pinned to **Solid 1.9.x**. Solid 2 is not yet possible here: `@tanstack/solid-form`
and `@tanstack/solid-store` have no Solid 2 build published, and the app fails to
build against Solid 2 with missing-export errors from inside those packages
(`onMount`, `Suspense`, `createResource`, `from` — all removed in Solid 2).

The SDK itself supports **both** Solid majors, so only the starter is waiting.

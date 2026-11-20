# Why this template carries its own `vercel.json`

Every deploy of this project failed with:

```
x Could not resolve workspace.
`-> Missing `devEngines.packageManager` or legacy `packageManager` field
    in package.json
Error: Command "turbo run build" exited with 1
```

## What was actually wrong

This template is **not a member of the monorepo's pnpm workspace** —
`pnpm-workspace.yaml` lists `apps/*`, `packages/*`, `sdk` and
`Consumers/custom-demo`, and nothing under `SDK-Starter-Templates/`. It is a
standalone project with its own `pnpm-lock.yaml`, exactly as a starter template
should be, since the whole point is that somebody can copy the directory out
and run it.

Vercel, however, sees a `turbo.json` at the repository root and concludes the
whole repo is a Turborepo. It then builds this project with the ROOT build
command, `turbo run build`. Turbo starts in this directory, finds a
`package.json` with no `packageManager` field and no workspace above it that
claims this package, and gives up.

The template itself was never broken: `pnpm install && pnpm build` here
succeeds, and did throughout.

## The fix

`vercel.json` states how this directory builds, which overrides the inherited
monorepo command. It installs with its own lockfile and runs its own `vite
build`, which is what a standalone template should do on any host.

## Why not the alternatives

- **Add `packageManager` to this `package.json`** — would satisfy turbo's
  error message and produce a worse outcome: the template would then be built
  *through* the monorepo's turbo pipeline, coupling a copy-and-go starter to
  the parent repo's build graph. The next person to copy the directory out
  would take a turbo dependency they never asked for.
- **Add the template to `pnpm-workspace.yaml`** — same objection, harder.
  Templates are meant to be standalone; hoisting their dependencies into the
  monorepo's store is how a starter quietly stops working outside it.
- **Turn the Vercel project off** — reasonable if nobody wants this deployed,
  and worth asking. It was left deploying, so it is now deploying correctly.

Any other template given a Vercel project will hit exactly this, and wants a
copy of this file's `vercel.json`.

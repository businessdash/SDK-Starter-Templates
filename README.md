# SDK-Starter-Templates

Working starter projects for [`@businessdash/sdk`](https://www.npmjs.com/package/@businessdash/sdk) — the developer SDK for [Business Dash](https://businessdash.us). One starter per framework. Each boots into a contractor-shaped landing page that pulls its copy from a Business Dash host through the package API.

> Published as `@biab-dev/sdk` through 0.9.53. That package is deprecated and frozen — install `@businessdash/sdk`.

## Why this repo exists

`@businessdash/sdk` is framework-agnostic — it's just a typed HTTP client. But every framework has its own convention for *where the bearer key lives*, *how server routes are declared*, and *how data flows into a component*. This repo ships one minimal but production-shaped project per framework so you can:

- **Start fresh** — `git clone` the starter you want and rename it.
- **Add to an existing codebase** — copy the `lib/biab*` files and a representative section component into your project. Each starter keeps the Business Dash-specific code small enough to lift wholesale.

## JavaScript / TypeScript starters

These consume the published npm package directly.

| Framework | Path | Server style | Notes |
|---|---|---|---|
| **Next.js (T3)** | [`T3-App/`](./T3-App) | App Router + RSC | tRPC wrapping the SDK. |
| **Astro** | [`Astro/`](./Astro) | `output: "server"` | Standard server endpoints. |
| **Nuxt 3** | [`Nuxt/`](./Nuxt) | Nitro `server/api/*` | `useFetch` consumers. |
| **Remix** | [`Remix/`](./Remix) | Resource routes | React Router 7 framework mode. |
| **SvelteKit** | [`Svelte/`](./Svelte) | `+page.server.ts` | Includes Storybook + Playwright wiring. |
| **TanStack Start** | [`Tanstack-Start/`](./Tanstack-Start) | `createServerFn` / `createAPIFileRoute` | Solid + React variants. |
| **Qwik** | [`Qwik/`](./Qwik) | Route loaders | |
| **Angular 18+** | [`Angular/`](./Angular) | Express SSR | Signals-based service. |
| **React (Vite)** | [`React-Bun/`](./React-Bun) | Bun companion server | Browser SPA + same-origin proxy. |
| **HTMX** | [`HTMX/`](./HTMX) | Bun HTTP server | Server-rendered fragments, `hx-get` triggers. |
| **Vanilla JS** | [`Vanilla-JS/`](./Vanilla-JS) | Bun HTTP server | No bundler. ES modules + a proxy route. |

## Mobile

| Platform | Path | Notes |
|---|---|---|
| **React Native (Expo)** | [`React-Native/`](./React-Native) | The one mobile starter that reuses `@businessdash/sdk` directly. |
| **Swift / iOS** | [`Swift/`](./Swift) | SwiftPM package + example app. Hand-written client. |
| **Kotlin / Android** | [`Kotlin/`](./Kotlin) | Two Gradle modules. Hand-written client. |
| **Flutter** | [`Flutter/`](./Flutter) | Two Dart packages. Hand-written client. |

Mobile clients talk to the package API **directly** — no proxy tier needed. Publishable scopes cover the whole customer-facing surface, so a mobile app ships a publishable token (`pk_…`) rather than a secret key.

## Non-JavaScript servers

No npm package to install — each ships a small hand-written client against the same REST surface.

| Language | Path | Notes |
|---|---|---|
| **PHP / Laravel** | [`Laravel/`](./Laravel) | Blade views + a service-container client. |
| **Elixir / Phoenix** | [`Phoenix/`](./Phoenix) | HEEx templates + a Req-based client. |
| **Swift / Vapor** | [`Vapor-Server/`](./Vapor-Server) | Server-side Swift, Leaf templates. |

## How to use

```bash
git clone https://github.com/businessdash/SDK-Starter-Templates.git
cd SDK-Starter-Templates/<framework>/
cp .env.example .env.local   # fill in the API key, site id, and package API base URL
pnpm install                 # or npm / bun / yarn — each starter declares its preferred manager
pnpm dev
```

Non-JS starters use their own toolchain (`composer install`, `mix deps.get`, `swift run`, `flutter pub get`, Gradle) — see each starter's own README.

Get the env values from **Site Builder → Developer → Package API keys** inside the Business Dash dashboard. See the [Getting Started](https://businessdash.us/docs/developer) doc for the full walkthrough.

## Schema as code

Each starter ships ready to read data. To **define a schema and seed data programmatically** — instead of clicking through the dashboard — every Business Dash tenant exposes:

1. **MCP** — a per-site Model Context Protocol server, so an AI agent can read your data model directly.
2. **Package API** at `https://<tenant-host>/api/package/v1` — the bearer-key client that creates collections, upserts rows, and reads them back.
3. **CLI** — `npx businessdash export-data-model` writes a versionable snapshot of the org's custom data model to disk. `export-graphql-schema` emits GraphQL SDL for the same model.

## Docs

- [Developer docs](https://businessdash.us/docs/developer)
- [Changelog](https://businessdash.us/docs/developer/changelog)
- npm: <https://www.npmjs.com/package/@businessdash/sdk>

## About this repo

This is a **one-way public mirror**. The source of truth is the private Business Dash monorepo; changes here flow back only by manual cherry-pick. Open issues against the docs rather than PRs against this mirror.

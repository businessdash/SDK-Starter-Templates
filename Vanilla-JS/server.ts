/**
 * Bun HTTP server — serves the vanilla `./public/` directory and proxies
 * `/api/biab/*` to BIAB via `@businessdash/sdk`. This server is the key-holder;
 * the browser only ever talks to same-origin endpoints.
 *
 * What's wired here (BIAB SDK 0.9.5, feature parity with the reference
 * consumer "David's Garage Pro"):
 *   - Marketing bundle, gallery, blog, scheduling, forms (the baseline).
 *   - Storefront + cart + checkout + subscriptions (visitor-token cart).
 *   - Customer portal + tenant auth (createAuthHandler at /api/biab-auth/*).
 *   - Reviews wall, news banner + updates feed.
 *   - Programmatic-SEO parallel pages + sitemap.xml / robots.txt proxies +
 *     JSON-LD injected into every server-rendered page <head>.
 *   - Revalidation webhook backed by a real in-memory tag cache.
 *   - Graceful degradation when BIAB env is unset, and a "site unavailable"
 *     state when the org's billing is suspended.
 *
 * Run: `bun run dev` (auto-reload) or `bun run start` (prod).
 */

import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
	createAuthHandler,
	createBiabClient,
	createBiabDevClient,
	getTenantSession,
} from "@businessdash/sdk";
import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";
import { llmsTxtHandler } from "@businessdash/sdk/distribution";
import { mcpHandler, mcpManifestHandler } from "@businessdash/sdk/mcp";
import { localBusiness, renderJsonLdToHtml, website } from "@businessdash/sdk/seo";

import {
	TODOS_OBJECT_ID,
	TODO_IMAGES_OBJECT_ID,
} from "./biab.data-model.config";
import { cached, invalidateTags } from "./lib/cache";

const PORT = Number(process.env.PORT ?? 3000);

const apiKey = process.env.BIAB_API_KEY;
// This starter is server-rendered (no client bundle) — it reads plain env vars
// directly and injects the browser-safe values into the page, so there's no
// public/private split to consolidate here.
const siteId = process.env.BIAB_SITE_ID;
const rawBaseUrl = process.env.BIAB_PACKAGE_API_BASE_URL;
const callbackUrl = process.env.BIAB_AUTH_CALLBACK_URL;
const revalidationSecret = process.env.BIAB_REVALIDATION_SECRET;
/** Browser-safe publishable token (`pk_…`, origin-locked, `followers:self`). */
const publishableKey = process.env.BIAB_PK;

if (!apiKey || !siteId || !rawBaseUrl) {
	console.warn(
		"\n[biab] Missing one of BIAB_API_KEY / BIAB_SITE_ID / BIAB_PACKAGE_API_BASE_URL.",
		"\n[biab] Set them in .env.local (see .env.example) — until then /api/biab/* returns 503",
		"\n[biab] and pages render their local fallbacks.\n",
	);
}

/** Host root (e.g. https://www.biab.app) — sitemap/robots live here. */
const hostBase = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, "") : null;
/** Package API base (…/api/package/v1) — the SDK transport target. */
const packageBase = hostBase
	? hostBase.endsWith("/api/package/v1")
		? hostBase
		: `${hostBase}/api/package/v1`
	: null;

const biab =
	apiKey && siteId && packageBase
		? createBiabClient({ apiKey, siteId, baseUrl: packageBase })
		: null;

/**
 * Custom-database reader for the Todos demo — the SDK's documented READ path
 * for custom collections is `createBiabDevClient(...).site(id).dataModel`
 * (`listRecords({ object })`). Needs `metadata:read_records` on the key.
 */
const biabDataModel =
	apiKey && siteId && packageBase
		? createBiabDevClient({ apiKey, baseUrl: packageBase }).site(siteId).dataModel
		: null;

// ── AI surfaces: llms.txt + MCP connector (SDK 0.9.53) ─────────────
// AEO (answer-engine optimization): `/llms.txt` serves the org-curated
// artifact from THIS domain's root — the only place AI crawlers look for it —
// while the source of truth stays on BIAB (Dashboard → Marketing → AI
// Distribution). `/api/mcp` + `/.well-known/mcp.json` give this domain the
// site's MCP connector: JSON-RPC proxied verbatim, with the platform still
// enforcing the org's MCP opt-in + per-tool write gates. All three take the
// BIAB app ORIGIN (`hostBase`), not the package API base. The companion
// PRODUCT FEED needs no proxy — build its URL with `productFeedUrl` from
// `@businessdash/sdk/distribution` and submit it to merchant/feed programs.

const llmsTxt =
	siteId && hostBase ? llmsTxtHandler({ siteId, baseUrl: hostBase }) : null;
const mcp = siteId && hostBase ? mcpHandler({ siteId, baseUrl: hostBase }) : null;
const mcpManifest =
	siteId && hostBase ? mcpManifestHandler({ siteId, baseUrl: hostBase }) : null;

/**
 * Browser-exposed config, injected into every page as `window.__BIAB_PUBLIC__`.
 * Only the PUBLISHABLE token (`pk_…`) ever reaches the browser — the bearer
 * `apiKey` stays server-side. Used by the newsletter subscribe section (followers)
 * and the privacy-conscious analytics in main.js. Null fields → those features
 * degrade to placeholders, so an unconfigured checkout still runs.
 */
const publicConfig: { pk: string | null; siteId: string | null; baseUrl: string | null } = {
	pk: publishableKey ?? null,
	siteId: siteId ?? null,
	baseUrl: packageBase,
};

/** A `<script>` tag that publishes `window.__BIAB_PUBLIC__` before any module
 *  runs. JSON.stringify keeps it injection-safe (no user-controlled values). */
function publicConfigScript(): string {
	return `<script>window.__BIAB_PUBLIC__=${JSON.stringify(publicConfig)};</script>`;
}

/** WorkOS-backed sign-in/up/out + callback, mounted at /api/biab-auth/*. */
const authHandler =
	apiKey && packageBase && callbackUrl
		? createAuthHandler({
				baseUrl: packageBase,
				apiKey,
				callbackUrl,
				defaultReturnTo: "/my-account",
				signOutReturnTo: "/",
			})
		: null;

/** HMAC-verified publish webhook → busts the in-memory tag cache. */
const revalidateHandler = revalidationSecret
	? createGenericRevalidateHandler({
			secret: revalidationSecret,
			onTagsRevalidated: (tags) => {
				const n = invalidateTags(tags);
				console.log(`[biab] revalidate: evicted ${n} cache entr${n === 1 ? "y" : "ies"} for`, tags);
			},
		})
	: null;

// ── small helpers ──────────────────────────────────────────────────

function json(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

function notConfigured(): Response {
	return json({ error: "BIAB not configured on this server. See .env.example." }, 503);
}

function errMessage(err: unknown): string {
	return err instanceof Error ? err.message : "Unknown error";
}

/** Map an SDK error to a response — suspension is its own 503 shape. */
function errResponse(err: unknown): Response {
	if (err instanceof BiabServiceSuspendedError || err instanceof BiabPaymentLapsedError) {
		return json({ error: "Site temporarily unavailable.", unavailable: true }, 503);
	}
	return json({ error: errMessage(err) }, 502);
}

function getCookie(req: Request, name: string): string | null {
	const header = req.headers.get("cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		if (part.slice(0, eq).trim() === name) {
			return decodeURIComponent(part.slice(eq + 1).trim());
		}
	}
	return null;
}

const VISITOR_COOKIE = "biab_cart_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days
const SESSION_COOKIE = "biab_session";

function visitorSetCookie(token: string): string {
	return `${VISITOR_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${VISITOR_MAX_AGE}`;
}

/** Resolve the visitor's cart, minting + returning a Set-Cookie when new. */
function resolveVisitor(req: Request): { token: string; setCookie?: string } {
	const existing = getCookie(req, VISITOR_COOKIE);
	if (existing) return { token: existing };
	const token = crypto.randomUUID();
	return { token, setCookie: visitorSetCookie(token) };
}

type Session = {
	token: string;
	organizationId: string;
	user: { id: string; email: string | null; firstName: string | null; lastName: string | null };
	role: string | null;
};

/** Validate the `biab_session` cookie against BIAB. Null when signed out. */
async function getSession(req: Request): Promise<Session | null> {
	if (!apiKey || !packageBase) return null;
	const token = getCookie(req, SESSION_COOKIE);
	if (!token) return null;
	try {
		const s = await getTenantSession({ cookieValue: token, baseUrl: packageBase, apiKey });
		if (!s) return null;
		return { token, organizationId: s.organizationId, user: s.user, role: s.role };
	} catch {
		return null;
	}
}

/** Session-scoped customer-portal client (work bundle, review submit). */
function portalFor(session: Session) {
	const client = createBiabDevClient({ apiKey: apiKey as string, baseUrl: packageBase as string });
	return client.customerPortal(session.organizationId).withSession(session.token);
}

// ── JSON-LD + HTML shell for server-rendered pages ─────────────────

function esc(s: string): string {
	return s.replace(/[&<>"]/g, (c) => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" })[c] as string);
}

/** Best-effort LocalBusiness + WebSite JSON-LD from the home bundle. */
async function siteJsonLd(origin: string): Promise<string> {
	if (!biab) return "";
	try {
		// biome-ignore lint: bundle shape is an untyped passthrough at 0.9.5
		const bundle = (await cached("bundle:home:en", ["biab:marketing"], () =>
			biab.marketing.getPageBundle({ pageKey: "home", locale: "en" }),
		)) as Record<string, any>;
		const company = (bundle?.company as any)?.profile ?? {};
		const info = (bundle?.sections as any)?.companyInfo?.data ?? (bundle?.sections as any)?.companyInfo ?? {};
		const name: string = company.name ?? info.name ?? "BIAB Starter Site";
		const nodes = [
			localBusiness({
				siteUrl: origin,
				name,
				telephone: company.phone ?? info.phone,
				email: company.email ?? info.email,
				description: (bundle?.seo as any)?.seoDescription ?? info.serviceArea,
			}),
			website({ siteUrl: origin, name }),
		];
		return renderJsonLdToHtml(nodes);
	} catch {
		return "";
	}
}

function navHtml(): string {
	return `<header class="docnav">
  <a class="docnav__brand" href="/">BIAB&nbsp;Starter</a>
  <nav class="docnav__links">
    <a href="/store">Store</a>
    <a href="/subscriptions">Plans</a>
    <a href="/reviews">Reviews</a>
    <a href="/updates">Updates</a>
    <a href="/todos">Todos</a>
    <a href="/cart">Cart</a>
    <a href="/my-account">Account</a>
  </nav>
  <span class="docnav__auth">
    <a href="/api/biab-auth/sign-in">Sign in</a>
    <a href="/api/biab-auth/sign-up" class="docnav__cta">Sign up</a>
  </span>
</header>`;
}

/** Server-render an HTML shell that loads a single page ES module. JSON-LD
 *  is injected here so crawlers see it without running any client JS. */
async function pageShell(opts: {
	origin: string;
	title: string;
	description?: string;
	module: string;
}): Promise<Response> {
	const jsonLd = await siteJsonLd(opts.origin);
	const html = `<!doctype html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1" />
  <title>${esc(opts.title)}</title>
  ${opts.description ? `<meta name="description" content="${esc(opts.description)}" />` : ""}
  <link rel="stylesheet" href="/styles.css" />
  <!-- SDK form styles (file-upload box, multi-step progress, choice chips). The
       container background is intentionally transparent — the template owns it. -->
  <link rel="stylesheet" href="/biab-forms.css" />
  ${publicConfigScript()}
  ${jsonLd}
</head>
<body>
  <div id="banner-root"></div>
  ${navHtml()}
  <main id="app" class="page"><p class="page__loading">Loading…</p></main>
  <script type="module">
    import { mountBanner } from "/banner.js";
    import { mountSetupBanner } from "/setup-banner.js";
    import render from "/pages/${opts.module}.js";
    mountBanner(document.getElementById("banner-root"));
    mountSetupBanner();
    render(document.getElementById("app"));
  </script>
</body>
</html>`;
	return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ── exact API routes ───────────────────────────────────────────────

const routes: Record<string, (req: Request) => Promise<Response>> = {
	"GET /api/biab/marketing-bundle": async (req) => {
		if (!biab) return notConfigured();
		const url = new URL(req.url);
		const pageKey = url.searchParams.get("pageKey") ?? "home";
		const locale = url.searchParams.get("locale") ?? "en";
		try {
			const bundle = await cached(
				`bundle:${pageKey}:${locale}`,
				["biab:marketing", `biab:marketing:${pageKey}`],
				() => biab.marketing.getPageBundle({ pageKey, locale }),
			);
			return json(bundle);
		} catch (err) {
			return errResponse(err);
		}
	},

	"GET /api/biab/content/extras": async (req) => {
		if (!biab) return notConfigured();
		const locale = new URL(req.url).searchParams.get("locale") ?? "en";
		try {
			// biome-ignore lint: banner/updates are untyped bundle passthroughs at 0.9.5
			const bundle = (await cached(`bundle:home:${locale}`, ["biab:marketing"], () =>
				biab.marketing.getPageBundle({ pageKey: "home", locale }),
			)) as Record<string, any>;
			return json({ banner: bundle?.banner ?? null, updates: bundle?.updates ?? null });
		} catch (err) {
			return errResponse(err);
		}
	},

	// Todos (custom-collections demo, `biab.data-model.config.ts`): read both
	// collections via the SDK's documented custom-database read path —
	// `dataModel.listRecords({ object })` — and join them here. Relations come
	// back as LINKS (`relations.todo` on each image is `[{ recordId, object }]`,
	// not an embedded row), so the join groups images by the todo they point at.
	// Creates go through the generated "Todo Form" via the existing
	// `POST /api/biab/forms/submit` proxy — forms are the SDK's documented
	// create path for custom collections; there is no direct row-write surface.
	"GET /api/biab/todos": async () => {
		if (!biabDataModel) return notConfigured();
		const asOptionalText = (value: unknown): string | null =>
			typeof value === "string" && value.length > 0 ? value : null;
		try {
			const [todosRes, imagesRes] = await Promise.all([
				biabDataModel.listRecords({ object: TODOS_OBJECT_ID, limit: 50 }),
				biabDataModel.listRecords({ object: TODO_IMAGES_OBJECT_ID, limit: 200 }),
			]);
			if (!todosRes.available || !imagesRes.available) {
				return json({
					available: false,
					reason:
						"Custom objects aren't available on this org's plan, or the model hasn't been promoted yet.",
					todos: [],
				});
			}
			const imagesByTodo = new Map<
				string,
				Array<{ url: string; alt: string | null; label: string | null }>
			>();
			for (const record of imagesRes.records) {
				const url = record.fields["url"];
				if (typeof url !== "string" || url.length === 0) continue;
				const image = {
					url,
					alt: asOptionalText(record.fields["alt"]),
					label: asOptionalText(record.fields["label"]),
				};
				for (const link of record.relations["todo"] ?? []) {
					const bucket = imagesByTodo.get(link.recordId) ?? [];
					bucket.push(image);
					imagesByTodo.set(link.recordId, bucket);
				}
			}
			return json({
				available: true,
				reason: null,
				todos: todosRes.records.map((record) => ({
					id: record.id,
					title:
						typeof record.fields["title"] === "string"
							? record.fields["title"]
							: "(untitled)",
					done: record.fields["done"] === true,
					notes: asOptionalText(record.fields["notes"]),
					createdAt: String(record.createdAt),
					images: imagesByTodo.get(record.id) ?? [],
				})),
			});
		} catch (err) {
			return json({ available: false, reason: errMessage(err), todos: [] });
		}
	},

	"GET /api/biab/gallery": async (req) => {
		if (!biab) return notConfigured();
		const limit = Number(new URL(req.url).searchParams.get("limit") ?? "12");
		try {
			const items = await cached(`gallery:${limit}`, ["biab:gallery"], () =>
				biab.gallery.list({ limit }),
			);
			return json({ items });
		} catch (err) {
			return errResponse(err);
		}
	},

	"GET /api/biab/blog/posts": async (req) => {
		if (!biab) return notConfigured();
		const limit = Number(new URL(req.url).searchParams.get("limit") ?? "6");
		try {
			const result = await cached(`blog:${limit}`, ["biab:blog"], () =>
				biab.blog.listPosts({ limit }),
			);
			return json(result);
		} catch (err) {
			return errResponse(err);
		}
	},

	"GET /api/biab/scheduling/event-types": async () => {
		if (!biab) return notConfigured();
		try {
			const items = await biab.scheduling.listEventTypes();
			return json({ items });
		} catch (err) {
			return errResponse(err);
		}
	},

	"GET /api/biab/scheduling/slots": async (req) => {
		if (!biab) return notConfigured();
		const url = new URL(req.url);
		const slug = url.searchParams.get("slug");
		const from = url.searchParams.get("from");
		const to = url.searchParams.get("to");
		if (!slug || !from || !to) return json({ error: "slug, from, to required" }, 400);
		try {
			const slots = await biab.scheduling.getAvailableSlots(slug, {
				from: new Date(from),
				to: new Date(to),
			});
			return json({ slots });
		} catch (err) {
			return errResponse(err);
		}
	},

	"POST /api/biab/scheduling/bookings": async (req) => {
		if (!biab) return notConfigured();
		try {
			const body = (await req.json()) as {
				eventTypeSlug: string;
				startAt: string;
				invitee: { email: string; name: string; phone?: string | null; timezone: string };
				notes?: string | null;
			};
			const result = await biab.scheduling.confirmBooking({
				eventTypeSlug: body.eventTypeSlug,
				startAt: new Date(body.startAt),
				invitee: body.invitee,
				notes: body.notes ?? null,
			});
			return json(result);
		} catch (err) {
			return json({ error: errMessage(err) }, 400);
		}
	},

	"GET /api/biab/forms/schema": async (req) => {
		if (!biab) return notConfigured();
		const slug = new URL(req.url).searchParams.get("slug");
		if (!slug) return json({ error: "slug required" }, 400);
		try {
			const schema = await biab.forms.schema(slug);
			return json(schema);
		} catch (err) {
			return errResponse(err);
		}
	},

	"POST /api/biab/forms/submit": async (req) => {
		if (!biab) return notConfigured();
		try {
			const body = (await req.json()) as {
				slug: string;
				data: Record<string, unknown>;
				submitterEmail?: string;
				submitterName?: string;
			};
			const result = await biab.forms.submit(body.slug, body.data, {
				submitterEmail: body.submitterEmail,
				submitterName: body.submitterName,
			});
			return json(result);
		} catch (err) {
			return json({ error: errMessage(err) }, 400);
		}
	},

	// ── storefront ────────────────────────────────────────────────
	"GET /api/biab/storefront/products": async (req) => {
		if (!biab) return notConfigured();
		const url = new URL(req.url);
		const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
		const categoryId = url.searchParams.get("categoryId") ?? undefined;
		try {
			const result = await cached(
				`products:${limit ?? ""}:${categoryId ?? ""}`,
				["biab:catalog"],
				() => biab.storefront.listProducts({ limit, categoryId }),
			);
			return json(result);
		} catch (err) {
			return errResponse(err);
		}
	},

	// Filterable grid + facets — the data behind a full shop page.
	"GET /api/biab/storefront/products-meta": async (req) => {
		if (!biab) return notConfigured();
		const url = new URL(req.url);
		const p = url.searchParams;
		const input: NonNullable<Parameters<typeof biab.storefront.listProductsWithMeta>[0]> = {};
		if (p.get("search")) input.search = p.get("search") as string;
		if (p.get("categoryId")) input.categoryId = p.get("categoryId") as string;
		if (p.has("minPriceCents")) input.minPriceCents = Number(p.get("minPriceCents"));
		if (p.has("maxPriceCents")) input.maxPriceCents = Number(p.get("maxPriceCents"));
		if (p.has("minRating")) input.minRating = Number(p.get("minRating"));
		if (p.get("sort")) input.sort = p.get("sort") as NonNullable<typeof input.sort>;
		if (p.has("limit")) input.limit = Number(p.get("limit"));
		try {
			// Filtered, per-visitor query — cache by the full query string.
			const result = await cached(
				`products-meta:${p.toString()}`,
				["biab:catalog"],
				() => biab.storefront.listProductsWithMeta(input),
			);
			return json(result);
		} catch (err) {
			return errResponse(err);
		}
	},

	"GET /api/biab/storefront/categories": async () => {
		if (!biab) return notConfigured();
		try {
			const result = await cached("storefront-categories", ["biab:catalog"], () =>
				biab.storefront.listCategories(),
			);
			return json(result);
		} catch (err) {
			return errResponse(err);
		}
	},

	"GET /api/biab/subscriptions": async () => {
		if (!biab) return notConfigured();
		try {
			const result = await cached("subscriptions", ["biab:catalog", "biab:subscriptions"], () =>
				biab.subscriptions.list(),
			);
			return json(result);
		} catch (err) {
			return errResponse(err);
		}
	},

	// ── reviews wall (paginated) ──────────────────────────────────
	"GET /api/biab/reviews": async (req) => {
		if (!biab) return notConfigured();
		const url = new URL(req.url);
		const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
		const offset = url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : undefined;
		try {
			const result = await cached(
				`reviews:${limit ?? ""}:${offset ?? ""}`,
				["biab:reviews"],
				() => biab.reviews.list({ limit, offset }),
			);
			return json(result);
		} catch (err) {
			return errResponse(err);
		}
	},

	// ── cart (visitor-token; never cached) ────────────────────────
	"GET /api/biab/cart": async (req) => {
		if (!biab) return notConfigured();
		const token = getCookie(req, VISITOR_COOKIE);
		if (!token) return json({ items: [], itemCount: 0 });
		try {
			const snapshot = await biab.cart.forVisitor(token).get();
			return json(snapshot);
		} catch (err) {
			return errResponse(err);
		}
	},

	"POST /api/biab/cart/add": async (req) => {
		if (!biab) return notConfigured();
		const { token, setCookie } = resolveVisitor(req);
		try {
			const body = (await req.json()) as { productId: string; variantId?: string | null; quantity?: number };
			const snapshot = await biab.cart.forVisitor(token).addItem({
				productId: body.productId,
				variantId: body.variantId ?? undefined,
				quantity: body.quantity ?? 1,
			});
			return json(snapshot, 200, setCookie ? { "Set-Cookie": setCookie } : {});
		} catch (err) {
			return errResponse(err);
		}
	},

	"POST /api/biab/cart/update": async (req) => {
		if (!biab) return notConfigured();
		const token = getCookie(req, VISITOR_COOKIE);
		if (!token) return json({ error: "No cart yet." }, 400);
		try {
			const body = (await req.json()) as { itemId: string; quantity: number };
			const snapshot = await biab.cart.forVisitor(token).updateItem(body.itemId, { quantity: body.quantity });
			return json(snapshot);
		} catch (err) {
			return errResponse(err);
		}
	},

	"POST /api/biab/cart/remove": async (req) => {
		if (!biab) return notConfigured();
		const token = getCookie(req, VISITOR_COOKIE);
		if (!token) return json({ error: "No cart yet." }, 400);
		try {
			const body = (await req.json()) as { itemId: string };
			const snapshot = await biab.cart.forVisitor(token).removeItem(body.itemId);
			return json(snapshot);
		} catch (err) {
			return errResponse(err);
		}
	},

	"POST /api/biab/cart/coupon": async (req) => {
		if (!biab) return notConfigured();
		const token = getCookie(req, VISITOR_COOKIE);
		if (!token) return json({ error: "No cart yet." }, 400);
		try {
			const body = (await req.json()) as { code: string };
			const snapshot = await biab.cart.forVisitor(token).applyCoupon({ code: body.code });
			return json(snapshot);
		} catch (err) {
			return errResponse(err);
		}
	},

	"POST /api/biab/cart/coupon/remove": async (req) => {
		if (!biab) return notConfigured();
		const token = getCookie(req, VISITOR_COOKIE);
		if (!token) return json({ error: "No cart yet." }, 400);
		try {
			const snapshot = await biab.cart.forVisitor(token).removeCoupon();
			return json(snapshot);
		} catch (err) {
			return errResponse(err);
		}
	},

	"POST /api/biab/cart/clear": async (req) => {
		if (!biab) return notConfigured();
		const token = getCookie(req, VISITOR_COOKIE);
		if (!token) return json({ items: [], itemCount: 0 });
		try {
			const snapshot = await biab.cart.forVisitor(token).clear();
			return json(snapshot);
		} catch (err) {
			return errResponse(err);
		}
	},

	// ── checkout ──────────────────────────────────────────────────
	"POST /api/biab/checkout/start": async (req) => {
		if (!biab) return notConfigured();
		const token = getCookie(req, VISITOR_COOKIE);
		if (!token) return json({ error: "Your cart is empty." }, 400);
		try {
			const body = (await req.json()) as { origin: string; customerEmail?: string };
			const result = await biab.checkout.forVisitor(token).start({
				...(body.customerEmail ? { customerEmail: body.customerEmail } : {}),
				successUrl: `${body.origin}/store?session_id={CHECKOUT_SESSION_ID}`,
				cancelUrl: `${body.origin}/cart`,
			});
			return json({ url: result.stripeUrl });
		} catch (err) {
			return errResponse(err);
		}
	},

	"GET /api/biab/checkout/status": async (req) => {
		if (!biab) return notConfigured();
		const sessionId = new URL(req.url).searchParams.get("session_id");
		if (!sessionId) return json({ error: "session_id required" }, 400);
		try {
			return json(await biab.checkout.getStatus(sessionId));
		} catch (err) {
			return errResponse(err);
		}
	},

	// ── customer portal ───────────────────────────────────────────
	"GET /api/biab/portal/work": async (req) => {
		const session = await getSession(req);
		if (!session) return json({ signedIn: false, work: null });
		try {
			const work = await portalFor(session).getWork();
			return json({ signedIn: true, user: session.user, work });
		} catch (err) {
			return errResponse(err);
		}
	},

	"POST /api/biab/portal/submit-review": async (req) => {
		const session = await getSession(req);
		if (!session) return json({ error: "Sign in to leave a review." }, 401);
		try {
			const body = (await req.json()) as { rating: number; body: string; jobId?: string | null };
			const result = await portalFor(session).submitReview({
				rating: body.rating,
				body: body.body,
				...(body.jobId ? { jobId: body.jobId } : {}),
			});
			return json(result);
		} catch (err) {
			return json({ error: errMessage(err) }, 400);
		}
	},

	// ── parallel pages (programmatic SEO) ─────────────────────────
	"GET /api/biab/parallel/variants": async (req) => {
		if (!biab) return notConfigured();
		const key = new URL(req.url).searchParams.get("key") ?? "service-area";
		try {
			const result = await cached(`pp:variants:${key}`, ["biab:parallel-pages"], () =>
				biab.parallelPages.listVariants(key),
			);
			return json(result);
		} catch (err) {
			return errResponse(err);
		}
	},

	"GET /api/biab/parallel/render": async (req) => {
		if (!biab) return notConfigured();
		const url = new URL(req.url);
		const key = url.searchParams.get("key") ?? "service-area";
		const service = url.searchParams.get("service");
		const area = url.searchParams.get("area");
		if (!service || !area) return json({ error: "service, area required" }, 400);
		try {
			const result = await cached(
				`pp:render:${key}:${service}:${area}`,
				["biab:parallel-pages"],
				() => biab.parallelPages.render(key, { service, area }),
			);
			return json(result);
		} catch (err) {
			return errResponse(err);
		}
	},
};

// ── pattern API routes (dynamic segments) ──────────────────────────

const patternRoutes: Array<{
	method: string;
	pattern: RegExp;
	handler: (req: Request, m: RegExpMatchArray) => Promise<Response>;
}> = [
	{
		method: "GET",
		pattern: /^\/api\/biab\/storefront\/product\/([^/]+)$/,
		handler: async (_req, m) => {
			if (!biab) return notConfigured();
			const id = decodeURIComponent(m[1] ?? "");
			try {
				const product = await cached(`product:${id}`, ["biab:catalog", `biab:product:${id}`], () =>
					biab.storefront.getProduct(id),
				);
				return json(product);
			} catch (err) {
				return errResponse(err);
			}
		},
	},
	{
		method: "GET",
		pattern: /^\/api\/biab\/storefront\/product\/([^/]+)\/reviews$/,
		handler: async (req, m) => {
			if (!biab) return notConfigured();
			const id = decodeURIComponent(m[1] ?? "");
			const url = new URL(req.url);
			const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
			const cursor = url.searchParams.has("cursor") ? Number(url.searchParams.get("cursor")) : undefined;
			try {
				const result = await cached(
					`product-reviews:${id}:${limit ?? ""}:${cursor ?? ""}`,
					["biab:catalog", `biab:product:${id}`, "biab:reviews"],
					() => biab.storefront.getProductReviews(id, { limit, cursor }),
				);
				return json(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},
	{
		method: "GET",
		pattern: /^\/api\/biab\/storefront\/product\/([^/]+)\/related$/,
		handler: async (req, m) => {
			if (!biab) return notConfigured();
			const id = decodeURIComponent(m[1] ?? "");
			const url = new URL(req.url);
			const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
			try {
				const result = await cached(
					`product-related:${id}:${limit ?? ""}`,
					["biab:catalog", `biab:product:${id}`],
					() => biab.storefront.getRelatedProducts(id, { limit }),
				);
				return json(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},
	{
		method: "GET",
		pattern: /^\/api\/biab\/storefront\/product\/([^/]+)\/addons$/,
		handler: async (_req, m) => {
			if (!biab) return notConfigured();
			const id = decodeURIComponent(m[1] ?? "");
			try {
				const result = await cached(
					`product-addons:${id}`,
					["biab:catalog", `biab:product:${id}`],
					() => biab.storefront.getProductAddons(id),
				);
				return json(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},
];

// ── SEO proxies (host root, not the package API path) ──────────────

async function proxySitemap(): Promise<Response> {
	const empty = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;
	if (!apiKey || !siteId || !hostBase) {
		return new Response(empty, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
	}
	try {
		const res = await fetch(`${hostBase}/sites/${encodeURIComponent(siteId)}/sitemap.xml`, {
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!res.ok) return new Response(empty, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
		return new Response(await res.text(), {
			headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=60" },
		});
	} catch {
		return new Response(empty, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
	}
}

async function proxyRobots(): Promise<Response> {
	const fallback = "User-agent: *\nAllow: /\n";
	if (!apiKey || !siteId || !hostBase) {
		return new Response(fallback, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}
	try {
		const res = await fetch(`${hostBase}/sites/${encodeURIComponent(siteId)}/robots.txt`, {
			headers: { Authorization: `Bearer ${apiKey}` },
		});
		if (!res.ok) return new Response(fallback, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
		return new Response(await res.text(), {
			headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60" },
		});
	} catch {
		return new Response(fallback, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}
}

// ── server-rendered HTML pages (each loads one /pages/*.js module) ─

async function matchHtmlPage(pathname: string, origin: string): Promise<Response | null> {
	switch (pathname) {
		case "/store":
			return pageShell({ origin, title: "Store", description: "Browse our products.", module: "store" });
		case "/cart":
			return pageShell({ origin, title: "Your cart", module: "cart" });
		case "/subscriptions":
			return pageShell({ origin, title: "Plans", description: "Subscription plans.", module: "subscriptions" });
		case "/my-account":
			return pageShell({ origin, title: "My account", module: "my-account" });
		case "/updates":
			return pageShell({ origin, title: "Updates", description: "Latest news & offers.", module: "updates" });
		case "/todos":
			return pageShell({ origin, title: "Todos", description: "Relational custom-collections demo.", module: "todos" });
		case "/reviews":
			return pageShell({ origin, title: "Reviews", description: "What customers say.", module: "reviews" });
		case "/services":
			return pageShell({ origin, title: "Service areas", description: "Programmatic-SEO pages.", module: "services" });
	}
	if (/^\/store\/[^/]+$/.test(pathname)) {
		return pageShell({ origin, title: "Product", module: "product" });
	}
	if (/^\/services\/[^/]+\/[^/]+$/.test(pathname)) {
		return pageShell({ origin, title: "Service area", module: "services-area" });
	}
	return null;
}

// ── static files ───────────────────────────────────────────────────

const CONTENT_TYPES: Record<string, string> = {
	".html": "text/html; charset=utf-8",
	".js": "text/javascript; charset=utf-8",
	".mjs": "text/javascript; charset=utf-8",
	".css": "text/css; charset=utf-8",
	".svg": "image/svg+xml",
	".png": "image/png",
	".jpg": "image/jpeg",
	".jpeg": "image/jpeg",
	".webp": "image/webp",
	".ico": "image/x-icon",
	".json": "application/json",
};

async function serveStatic(pathname: string): Promise<Response | null> {
	const path = pathname === "/" ? "/index.html" : pathname;
	const file = Bun.file(`./public${path}`);
	if (!(await file.exists())) return null;
	const ext = path.slice(path.lastIndexOf("."));
	const type = CONTENT_TYPES[ext] ?? "application/octet-stream";
	return new Response(file, { headers: { "Content-Type": type } });
}

/**
 * Serve the SDK's form stylesheet (file-upload box, multi-step progress header,
 * choice chips) from the installed package, so the `<link rel="stylesheet"
 * href="/biab-forms.css">` in every page resolves. Falls back to an empty sheet
 * if the package isn't installed yet (e.g. before `bun install`), so the page
 * never 404s a stylesheet. The template owns the container background — this
 * sheet leaves it transparent.
 */
async function serveFormsCss(): Promise<Response> {
	const file = Bun.file("./node_modules/@businessdash/sdk/dist/biab-forms.css");
	const body = (await file.exists()) ? file : "/* @businessdash/sdk/biab-forms.css not installed yet */\n";
	return new Response(body, {
		headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=300" },
	});
}

/**
 * Serve the static home shell, injecting `window.__BIAB_PUBLIC__` (publishable
 * config) and the SDK forms stylesheet into <head>. The home page hosts the
 * contact form + the newsletter subscribe section, so it needs both — the
 * feature pages get them via `pageShell()`.
 */
async function serveHome(): Promise<Response | null> {
	const file = Bun.file("./public/index.html");
	if (!(await file.exists())) return null;
	const html = await file.text();
	const injected = html.replace(
		"</head>",
		`  <link rel="stylesheet" href="/biab-forms.css" />\n    ${publicConfigScript()}\n  </head>`,
	);
	return new Response(injected, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ── dispatch ────────────────────────────────────────────────────────

const server = Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const { pathname } = url;
		const method = req.method;

		// WorkOS sign-in/up/out/callback — pass the web Request straight to
		// the SDK handler and return its Response (redirects + Set-Cookie).
		if (pathname === "/api/biab-auth" || pathname.startsWith("/api/biab-auth/")) {
			if (!authHandler) return notConfigured();
			return method === "POST" ? authHandler.POST(req) : authHandler.GET(req);
		}

		// Publish webhook → busts the in-memory tag cache.
		if (method === "POST" && pathname === "/api/biab/revalidate") {
			if (!revalidateHandler) return json({ error: "BIAB_REVALIDATION_SECRET not set." }, 503);
			return revalidateHandler(req);
		}

		// SEO endpoints.
		if (method === "GET" && pathname === "/sitemap.xml") return proxySitemap();
		if (method === "GET" && pathname === "/robots.txt") return proxyRobots();

		// AI surfaces — llms.txt (AEO) + the MCP connector on this domain.
		if (method === "GET" && pathname === "/llms.txt") {
			if (!llmsTxt) return new Response("llms.txt is not configured.\n", { status: 404 });
			return llmsTxt();
		}
		if (pathname === "/api/mcp") {
			if (!mcp) return json({ error: "MCP is not configured." }, 503);
			return method === "POST" ? mcp.POST(req) : mcp.GET();
		}
		if (method === "GET" && pathname === "/.well-known/mcp.json") {
			if (!mcpManifest) return json({ error: "MCP is not configured." }, 503);
			return mcpManifest(req);
		}

		// SDK form stylesheet (served from the installed package).
		if (method === "GET" && pathname === "/biab-forms.css") return serveFormsCss();

		// Exact API routes.
		const exact = routes[`${method} ${pathname}`];
		if (exact) return exact(req);

		// Pattern API routes.
		for (const r of patternRoutes) {
			if (r.method !== method) continue;
			const m = pathname.match(r.pattern);
			if (m) return r.handler(req, m);
		}

		if (method === "GET") {
			// Home shell — injected with __BIAB_PUBLIC__ + the forms stylesheet.
			if (pathname === "/" || pathname === "/index.html") {
				const home = await serveHome();
				if (home) return home;
			}
			// Static assets.
			const file = await serveStatic(pathname);
			if (file) return file;
			// Server-rendered feature pages.
			const page = await matchHtmlPage(pathname, url.origin);
			if (page) return page;
			// Fallback to the (injected) home shell.
			const fallback = await serveHome();
			if (fallback) return fallback;
		}
		return json({ error: "Not found" }, 404);
	},
});

console.log(`[biab-vanilla] http://localhost:${server.port}`);

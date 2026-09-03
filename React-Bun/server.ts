/**
 * Bun HTTP server — the **API-key holder** for this React SPA.
 *
 * Pure SPAs can't talk to BD directly (no safe way to hide an API key in the
 * browser bundle), so this Bun process:
 *   1. Holds `BD_API_KEY` server-side and proxies `/api/bd/*` to BD via
 *      `@businessdash/sdk` — storefront, cart, checkout, subscriptions, reviews,
 *      customer portal, parallel pages, plus the baseline marketing/gallery/
 *      blog/scheduling/forms surfaces.
 *   2. Mounts the WorkOS auth handler (`/api/bd-auth/*`) and the revalidation
 *      webhook (backed by a real in-memory tag cache), and proxies
 *      `/sitemap.xml` + `/robots.txt`.
 *   3. Serves the Vite-built `dist/` in production (with JSON-LD injected into
 *      index.html for crawlers). In dev, Vite (:5173) forwards `/api/bd/*`,
 *      `/sitemap.xml`, `/robots.txt` here — see `vite.config.ts`.
 *
 * Browser → /api/bd/<route> → Bun (this file) → BD Package API.
 */

import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
	createAuthHandler,
	createBdClient,
	createBdApiClient,
	getTenantSession,
} from "@businessdash/sdk";
import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";
import { llmsTxtHandler, productFeedUrl } from "@businessdash/sdk/distribution";
import { mcpHandler, mcpManifestHandler } from "@businessdash/sdk/mcp";
import { localBusiness, renderJsonLdToHtml, website } from "@businessdash/sdk/seo";

import {
	TODO_IMAGES_OBJECT_ID,
	TODOS_OBJECT_ID,
} from "./bd.data-model.config";

const PORT = Number(process.env.PORT ?? 3000);

const apiKey = process.env.BD_API_KEY;
// SITE_ID + base URL aren't secret; the canonical vars are the VITE_
// twins (the browser needs them too). Fall back to the legacy server-only names
// so already-deployed apps keep working.
const siteId = process.env.VITE_BD_SITE_ID ?? process.env.BD_SITE_ID;
const rawBaseUrl =
	process.env.VITE_BD_PACKAGE_API_BASE_URL ??
	process.env.BD_PACKAGE_API_BASE_URL;
const callbackUrl = process.env.BD_AUTH_CALLBACK_URL;
const revalidationSecret = process.env.BD_REVALIDATION_SECRET;

if (!apiKey || !siteId || !rawBaseUrl) {
	console.warn(
		"\n[bd] Missing one of BD_API_KEY / BD_SITE_ID / BD_PACKAGE_API_BASE_URL.",
		"\n[bd] Set them in .env.local (see .env.example) — until then /api/bd/* returns 503.\n",
	);
}

const hostBase = rawBaseUrl ? rawBaseUrl.replace(/\/+$/, "") : null;
const packageBase = hostBase
	? hostBase.endsWith("/api/package/v1")
		? hostBase
		: `${hostBase}/api/package/v1`
	: null;

const bd =
	apiKey && siteId && packageBase ? createBdClient({ apiKey, siteId, baseUrl: packageBase }) : null;

// The dev client reaches the org's CUSTOM DATABASE (`dataModel.listRecords`,
// scope `metadata:read_records`) — a different surface from the content client
// above. Used by the /api/bd/todos route.
const bdDev =
	apiKey && siteId && packageBase ? createBdApiClient({ apiKey, baseUrl: packageBase }) : null;

// AEO + MCP proxies live on the platform ORIGIN (`…/api/public/ai-feed/…`,
// `…/api/public/mcp/…`), not the package API — derive the bare origin from
// the same base URL.
const distributionConfig = (() => {
	if (!siteId || !hostBase) return null;
	try {
		return { siteId, baseUrl: new URL(hostBase).origin };
	} catch {
		return null;
	}
})();

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

// ── in-memory tag cache (the revalidation webhook's target) ────────

type CacheEntry = { value: unknown; expires: number; tags: string[] };
const cacheStore = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;

async function cached<T>(key: string, tags: string[], fn: () => Promise<T>): Promise<T> {
	const now = Date.now();
	const hit = cacheStore.get(key);
	if (hit && hit.expires > now) return hit.value as T;
	const value = await fn();
	cacheStore.set(key, { value, expires: now + DEFAULT_TTL_MS, tags });
	return value;
}

function invalidateTags(tags: string[]): number {
	if (!tags || tags.length === 0) {
		const n = cacheStore.size;
		cacheStore.clear();
		return n;
	}
	const wanted = new Set(tags);
	let evicted = 0;
	for (const [key, entry] of cacheStore) {
		if (entry.tags.some((t) => wanted.has(t))) {
			cacheStore.delete(key);
			evicted++;
		}
	}
	return evicted;
}

const revalidateHandler = revalidationSecret
	? createGenericRevalidateHandler({
			secret: revalidationSecret,
			onTagsRevalidated: (tags) => {
				const n = invalidateTags(tags);
				console.log(`[bd] revalidate: evicted ${n} cache entries for`, tags);
			},
		})
	: null;

// ── helpers ────────────────────────────────────────────────────────

function jsonResponse(body: unknown, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json", ...headers },
	});
}

function notConfigured(): Response {
	return jsonResponse({ error: "BD not configured on this server. See .env.example." }, 503);
}

function errMessage(err: unknown): string {
	return err instanceof Error ? err.message : "Unknown error";
}

function errResponse(err: unknown): Response {
	if (err instanceof BdServiceSuspendedError || err instanceof BdPaymentLapsedError) {
		return jsonResponse({ error: "Site temporarily unavailable.", unavailable: true }, 503);
	}
	return jsonResponse({ error: errMessage(err) }, 502);
}

const VISITOR_COOKIE = "bd_cart_visitor";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180;
const SESSION_COOKIE = "bd_session";

function getCookie(req: Request, name: string): string | null {
	const header = req.headers.get("cookie");
	if (!header) return null;
	for (const part of header.split(";")) {
		const eq = part.indexOf("=");
		if (eq === -1) continue;
		if (part.slice(0, eq).trim() === name) return decodeURIComponent(part.slice(eq + 1).trim());
	}
	return null;
}

function resolveVisitor(req: Request): { token: string; setCookie?: string } {
	const existing = getCookie(req, VISITOR_COOKIE);
	if (existing) return { token: existing };
	const token = crypto.randomUUID();
	return {
		token,
		setCookie: `${VISITOR_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${VISITOR_MAX_AGE}`,
	};
}

type Session = {
	token: string;
	organizationId: string;
	user: { id: string; email: string | null; firstName: string | null; lastName: string | null };
	role: string | null;
};

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

function portalFor(session: Session) {
	const client = createBdApiClient({ apiKey: apiKey as string, baseUrl: packageBase as string });
	return client.customerPortal(session.organizationId).withSession(session.token);
}

// ── API route table ────────────────────────────────────────────────

type Route = { handler: (req: Request) => Promise<Response> };

const routes: Record<string, Route> = {
	"GET /api/bd/marketing-bundle": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const url = new URL(req.url);
			const pageKey = url.searchParams.get("pageKey") ?? "home";
			const locale = url.searchParams.get("locale") ?? "en";
			try {
				const bundle = await cached(`bundle:${pageKey}:${locale}`, ["bd:marketing", `bd:marketing:${pageKey}`], () =>
					bd.marketing.getPageBundle({ pageKey, locale }),
				);
				return jsonResponse(bundle);
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/content/extras": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const locale = new URL(req.url).searchParams.get("locale") ?? "en";
			try {
				const bundle = (await cached(`bundle:home:${locale}`, ["bd:marketing"], () =>
					bd.marketing.getPageBundle({ pageKey: "home", locale }),
				)) as Record<string, unknown>;
				return jsonResponse({ banner: bundle?.banner ?? null, updates: bundle?.updates ?? null });
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/gallery": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const url = new URL(req.url);
			const limit = Number(url.searchParams.get("limit") ?? "12");
			const fieldsParam = url.searchParams.get("fields");
			try {
				const items = await cached(`gallery:${limit}:${fieldsParam ?? ""}`, ["bd:gallery"], () =>
					fieldsParam
						? bd.gallery.list({ limit, fields: fieldsParam.split(",") as unknown as readonly [] })
						: bd.gallery.list({ limit }),
				);
				return jsonResponse({ items });
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/blog/posts": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const limit = Number(new URL(req.url).searchParams.get("limit") ?? "6");
			try {
				const result = await cached(`blog:${limit}`, ["bd:blog"], () => bd.blog.listPosts({ limit }));
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/scheduling/event-types": {
		handler: async () => {
			if (!bd) return notConfigured();
			try {
				return jsonResponse({ items: await bd.scheduling.listEventTypes() });
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/scheduling/slots": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const url = new URL(req.url);
			const slug = url.searchParams.get("slug");
			const fromStr = url.searchParams.get("from");
			const toStr = url.searchParams.get("to");
			if (!slug || !fromStr || !toStr) return jsonResponse({ error: "slug, from, to required" }, 400);
			try {
				const slots = await bd.scheduling.getAvailableSlots(slug, { from: new Date(fromStr), to: new Date(toStr) });
				return jsonResponse({ slots });
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/scheduling/bookings": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			try {
				const body = (await req.json()) as {
					eventTypeSlug: string;
					startAt: string;
					invitee: { email: string; name: string; phone?: string | null; timezone: string };
					notes?: string | null;
				};
				const result = await bd.scheduling.confirmBooking({
					eventTypeSlug: body.eventTypeSlug,
					startAt: new Date(body.startAt),
					invitee: body.invitee,
					notes: body.notes ?? null,
				});
				return jsonResponse(result);
			} catch (err) {
				return jsonResponse({ error: errMessage(err) }, 400);
			}
		},
	},

	"GET /api/bd/forms/schema": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const slug = new URL(req.url).searchParams.get("slug");
			if (!slug) return jsonResponse({ error: "slug required" }, 400);
			try {
				return jsonResponse(await bd.forms.schema(slug));
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/forms/submit": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			try {
				const body = (await req.json()) as {
					slug: string;
					data: Record<string, unknown>;
					submitterEmail?: string;
					submitterName?: string;
					dryRun?: boolean;
					source?: string;
					referrer?: string;
					metadata?: Record<string, unknown>;
				};
				const result = await bd.forms.submit(body.slug, body.data, {
					submitterEmail: body.submitterEmail,
					submitterName: body.submitterName,
					dryRun: body.dryRun,
					source: body.source,
					referrer: body.referrer,
					metadata: body.metadata,
				});
				return jsonResponse(result);
			} catch (err) {
				return jsonResponse({ error: errMessage(err) }, 400);
			}
		},
	},

	"GET /api/bd/storefront/products": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const url = new URL(req.url);
			const p = url.searchParams;
			const limit = p.has("limit") ? Number(p.get("limit")) : undefined;
			const categoryId = p.get("categoryId") ?? undefined;
			// `meta=1` → the filterable listing (facets + ratings + richer cards).
			if (p.get("meta") === "1") {
				const search = p.get("search") ?? undefined;
				const minPriceCents = p.has("minPriceCents") ? Number(p.get("minPriceCents")) : undefined;
				const maxPriceCents = p.has("maxPriceCents") ? Number(p.get("maxPriceCents")) : undefined;
				const minRating = p.has("minRating") ? Number(p.get("minRating")) : undefined;
				const sort = (p.get("sort") as
					| "featured"
					| "newest"
					| "price-asc"
					| "price-desc"
					| "rating-desc"
					| null) ?? undefined;
				const cacheKey = `products:meta:${[limit, categoryId, search, minPriceCents, maxPriceCents, minRating, sort].join("|")}`;
				try {
					const result = await cached(cacheKey, ["bd:catalog"], () =>
						bd.storefront.listProductsWithMeta({
							limit,
							categoryId,
							search,
							minPriceCents,
							maxPriceCents,
							minRating,
							sort,
						}),
					);
					return jsonResponse(result);
				} catch (err) {
					return errResponse(err);
				}
			}
			try {
				const result = await cached(`products:${limit ?? ""}:${categoryId ?? ""}`, ["bd:catalog"], () =>
					bd.storefront.listProducts({ limit, categoryId }),
				);
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/storefront/categories": {
		handler: async () => {
			if (!bd) return notConfigured();
			try {
				const result = await cached("categories", ["bd:catalog"], () => bd.storefront.listCategories());
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/subscriptions": {
		handler: async () => {
			if (!bd) return notConfigured();
			try {
				const result = await cached("subscriptions", ["bd:catalog", "bd:subscriptions"], () => bd.subscriptions.list());
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/reviews": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const url = new URL(req.url);
			const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
			const offset = url.searchParams.has("offset") ? Number(url.searchParams.get("offset")) : undefined;
			try {
				const result = await cached(`reviews:${limit ?? ""}:${offset ?? ""}`, ["bd:reviews"], () =>
					bd.reviews.list({ limit, offset }),
				);
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/cart": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const token = getCookie(req, VISITOR_COOKIE);
			if (!token) return jsonResponse({ items: [], itemCount: 0, subtotal: 0, currency: "USD" });
			try {
				return jsonResponse(await bd.cart.forVisitor(token).get());
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/cart/add": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const { token, setCookie } = resolveVisitor(req);
			try {
				const body = (await req.json()) as { productId: string; variantId?: string | null; quantity?: number };
				const snapshot = await bd.cart.forVisitor(token).addItem({
					productId: body.productId,
					variantId: body.variantId ?? undefined,
					quantity: body.quantity ?? 1,
				});
				return jsonResponse(snapshot, 200, setCookie ? { "Set-Cookie": setCookie } : {});
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/cart/update": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const token = getCookie(req, VISITOR_COOKIE);
			if (!token) return jsonResponse({ error: "No cart yet." }, 400);
			try {
				const body = (await req.json()) as { itemId: string; quantity: number };
				return jsonResponse(await bd.cart.forVisitor(token).updateItem(body.itemId, { quantity: body.quantity }));
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/cart/remove": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const token = getCookie(req, VISITOR_COOKIE);
			if (!token) return jsonResponse({ error: "No cart yet." }, 400);
			try {
				const body = (await req.json()) as { itemId: string };
				return jsonResponse(await bd.cart.forVisitor(token).removeItem(body.itemId));
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/cart/coupon": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const token = getCookie(req, VISITOR_COOKIE);
			if (!token) return jsonResponse({ error: "No cart yet." }, 400);
			try {
				const body = (await req.json()) as { code: string };
				return jsonResponse(await bd.cart.forVisitor(token).applyCoupon({ code: body.code }));
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/cart/coupon/remove": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const token = getCookie(req, VISITOR_COOKIE);
			if (!token) return jsonResponse({ error: "No cart yet." }, 400);
			try {
				return jsonResponse(await bd.cart.forVisitor(token).removeCoupon());
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/cart/clear": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const token = getCookie(req, VISITOR_COOKIE);
			if (!token) return jsonResponse({ items: [], itemCount: 0, subtotal: 0, currency: "USD" });
			try {
				return jsonResponse(await bd.cart.forVisitor(token).clear());
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/checkout/start": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const token = getCookie(req, VISITOR_COOKIE);
			if (!token) return jsonResponse({ error: "Your cart is empty." }, 400);
			try {
				const body = (await req.json()) as { origin: string; customerEmail?: string };
				const result = await bd.checkout.forVisitor(token).start({
					...(body.customerEmail ? { customerEmail: body.customerEmail } : {}),
					successUrl: `${body.origin}/store?session_id={CHECKOUT_SESSION_ID}`,
					cancelUrl: `${body.origin}/cart`,
				});
				return jsonResponse({ url: result.stripeUrl });
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/portal/work": {
		handler: async (req) => {
			const session = await getSession(req);
			if (!session) return jsonResponse({ signedIn: false, work: null });
			try {
				return jsonResponse({ signedIn: true, user: session.user, work: await portalFor(session).getWork() });
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"POST /api/bd/portal/submit-review": {
		handler: async (req) => {
			const session = await getSession(req);
			if (!session) return jsonResponse({ error: "Sign in to leave a review." }, 401);
			try {
				const body = (await req.json()) as { rating: number; body: string; jobId?: string | null };
				const result = await portalFor(session).submitReview({
					rating: body.rating,
					body: body.body,
					...(body.jobId ? { jobId: body.jobId } : {}),
				});
				return jsonResponse(result);
			} catch (err) {
				return jsonResponse({ error: errMessage(err) }, 400);
			}
		},
	},

	"GET /api/bd/parallel/variants": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const key = new URL(req.url).searchParams.get("key") ?? "service-area";
			try {
				const result = await cached(`pp:variants:${key}`, ["bd:parallel-pages"], () => bd.parallelPages.listVariants(key));
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	"GET /api/bd/parallel/render": {
		handler: async (req) => {
			if (!bd) return notConfigured();
			const url = new URL(req.url);
			const key = url.searchParams.get("key") ?? "service-area";
			const service = url.searchParams.get("service");
			const area = url.searchParams.get("area");
			if (!service || !area) return jsonResponse({ error: "service, area required" }, 400);
			try {
				const result = await cached(`pp:render:${key}:${service}:${area}`, ["bd:parallel-pages"], () =>
					bd.parallelPages.render(key, { service, area }),
				);
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		},
	},

	// Custom-collections demo (see bd.data-model.config.ts): todos with their
	// images joined on, read via `dataModel.listRecords`. Relations come back as
	// LINKS (`{ recordId, object }`), not embedded rows — the join happens here.
	// Creates go through the generated `todo-form` via the existing forms proxy.
	"GET /api/bd/todos": {
		handler: async () => {
			if (!bdDev || !siteId) return jsonResponse({ status: "unconfigured" });
			try {
				const site = bdDev.site(siteId);
				const [todosPage, imagesPage] = await Promise.all([
					site.dataModel.listRecords({ object: TODOS_OBJECT_ID, limit: 50 }),
					site.dataModel.listRecords({ object: TODO_IMAGES_OBJECT_ID, limit: 200 }),
				]);
				if (!todosPage.available || !imagesPage.available) {
					return jsonResponse({ status: "unavailable" });
				}
				const imagesByTodo = new Map<string, Array<Record<string, unknown>>>();
				for (const record of imagesPage.records) {
					const link = record.relations.todo?.[0];
					if (!link) continue;
					const list = imagesByTodo.get(link.recordId) ?? [];
					list.push({
						id: record.id,
						url: typeof record.fields.url === "string" ? record.fields.url : "",
						alt: typeof record.fields.alt === "string" ? record.fields.alt : null,
						label: typeof record.fields.label === "string" ? record.fields.label : null,
					});
					imagesByTodo.set(link.recordId, list);
				}
				return jsonResponse({
					status: "ok",
					todos: todosPage.records.map((record) => ({
						id: record.id,
						title: typeof record.fields.title === "string" ? record.fields.title : "Untitled",
						done: record.fields.done === true,
						notes: typeof record.fields.notes === "string" ? record.fields.notes : null,
						createdAt: record.createdAt,
						images: imagesByTodo.get(record.id) ?? [],
					})),
				});
			} catch {
				// 403 scope / 404 unpromoted model / network — the page shows a
				// setup notice instead of crashing.
				return jsonResponse({ status: "unavailable" });
			}
		},
	},
};

// ── SEO proxies + JSON-LD injection ────────────────────────────────

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

// ── AEO + MCP proxies (SDK 0.9.53) ─────────────────────────────────
//
// `/llms.txt` — the answer-engine index curated at BD → Marketing → AI
// Distribution, served from this site's own root (the only place the llms.txt
// convention works). `/api/mcp` + `/.well-known/mcp.json` — the site's MCP
// connector on THIS domain, so the URL an org hands to Claude / ChatGPT /
// Gemini is their own site; the platform still enforces the org's MCP opt-in
// and per-tool write gates. `/ai/product-feed` — a convenience redirect to the
// product feed's BD URL (submit that URL to merchant programs directly).

async function serveLlmsTxt(): Promise<Response> {
	if (!distributionConfig) return new Response("Not found", { status: 404 });
	return llmsTxtHandler(distributionConfig)();
}

async function serveMcp(req: Request, method: string): Promise<Response> {
	if (!distributionConfig) {
		return method === "POST"
			? jsonResponse({ jsonrpc: "2.0", id: null, error: { code: -32603, message: "BD is not configured." } }, 503)
			: new Response(null, { status: 405, headers: { Allow: "POST" } });
	}
	const proxy = mcpHandler(distributionConfig);
	return method === "POST" ? proxy.POST(req) : proxy.GET();
}

async function serveMcpManifest(req: Request): Promise<Response> {
	if (!distributionConfig) return jsonResponse({ error: "not_configured" }, 404);
	return mcpManifestHandler(distributionConfig)(req);
}

async function serveProductFeedRedirect(): Promise<Response> {
	if (!distributionConfig) return new Response("Not found", { status: 404 });
	return Response.redirect(productFeedUrl(distributionConfig), 307);
}

async function siteJsonLd(origin: string): Promise<string> {
	if (!bd) return "";
	try {
		// biome-ignore lint: bundle shape is an untyped passthrough at 0.9.5
		const bundle = (await cached("bundle:home:en", ["bd:marketing"], () =>
			bd.marketing.getPageBundle({ pageKey: "home", locale: "en" }),
		)) as Record<string, any>;
		const company = (bundle?.company as any)?.profile ?? {};
		const info = (bundle?.sections as any)?.companyInfo?.data ?? (bundle?.sections as any)?.companyInfo ?? {};
		const name: string = company.name ?? info.name ?? "BD Starter Site";
		return renderJsonLdToHtml([
			localBusiness({ siteUrl: origin, name, telephone: company.phone ?? info.phone, email: company.email ?? info.email }),
			website({ siteUrl: origin, name }),
		]);
	} catch {
		return "";
	}
}

const isProd = process.env.NODE_ENV === "production";

async function serveIndexHtml(origin: string): Promise<Response> {
	const file = Bun.file("./dist/index.html");
	let html = await file.text();
	const jsonLd = await siteJsonLd(origin);
	if (jsonLd) html = html.replace("</head>", `${jsonLd}</head>`);
	return new Response(html, { headers: { "Content-Type": "text/html; charset=utf-8" } });
}

// ── dispatch ────────────────────────────────────────────────────────

const server = Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const { pathname } = url;
		const method = req.method;

		// WorkOS auth.
		if (pathname === "/api/bd-auth" || pathname.startsWith("/api/bd-auth/")) {
			if (!authHandler) return notConfigured();
			return method === "POST" ? authHandler.POST(req) : authHandler.GET(req);
		}

		// Publish webhook.
		if (method === "POST" && pathname === "/api/bd/revalidate") {
			if (!revalidateHandler) return jsonResponse({ error: "BD_REVALIDATION_SECRET not set." }, 503);
			return revalidateHandler(req);
		}

		// SEO.
		if (method === "GET" && pathname === "/sitemap.xml") return proxySitemap();
		if (method === "GET" && pathname === "/robots.txt") return proxyRobots();

		// AEO + MCP (see the "AEO + MCP proxies" section above).
		if (method === "GET" && pathname === "/llms.txt") return serveLlmsTxt();
		if (pathname === "/api/mcp") return serveMcp(req, method);
		if (method === "GET" && pathname === "/.well-known/mcp.json") return serveMcpManifest(req);
		if (method === "GET" && pathname === "/ai/product-feed") return serveProductFeedRedirect();

		// Dynamic product detail.
		const productMatch = pathname.match(/^\/api\/bd\/storefront\/product\/([^/]+)$/);
		if (method === "GET" && productMatch) {
			if (!bd) return notConfigured();
			const id = decodeURIComponent(productMatch[1] ?? "");
			try {
				const product = await cached(`product:${id}`, ["bd:catalog", `bd:product:${id}`], () => bd.storefront.getProduct(id));
				return jsonResponse(product);
			} catch (err) {
				return errResponse(err);
			}
		}

		// Product reviews (cursor-paginated) + aggregate (avgRating, totalCount).
		const reviewsMatch = pathname.match(/^\/api\/bd\/storefront\/product\/([^/]+)\/reviews$/);
		if (method === "GET" && reviewsMatch) {
			if (!bd) return notConfigured();
			const id = decodeURIComponent(reviewsMatch[1] ?? "");
			const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
			const cursor = url.searchParams.has("cursor") ? Number(url.searchParams.get("cursor")) : undefined;
			try {
				const result = await cached(`product:${id}:reviews:${limit ?? ""}:${cursor ?? ""}`, ["bd:reviews", `bd:product:${id}`], () =>
					bd.storefront.getProductReviews(id, { limit, cursor }),
				);
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		}

		// "You may also like" recommendations.
		const relatedMatch = pathname.match(/^\/api\/bd\/storefront\/product\/([^/]+)\/related$/);
		if (method === "GET" && relatedMatch) {
			if (!bd) return notConfigured();
			const id = decodeURIComponent(relatedMatch[1] ?? "");
			const limit = url.searchParams.has("limit") ? Number(url.searchParams.get("limit")) : undefined;
			try {
				const result = await cached(`product:${id}:related:${limit ?? ""}`, ["bd:catalog", `bd:product:${id}`], () =>
					bd.storefront.getRelatedProducts(id, { limit }),
				);
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		}

		// Companion / cross-sell addons ("complete your X").
		const addonsMatch = pathname.match(/^\/api\/bd\/storefront\/product\/([^/]+)\/addons$/);
		if (method === "GET" && addonsMatch) {
			if (!bd) return notConfigured();
			const id = decodeURIComponent(addonsMatch[1] ?? "");
			try {
				const result = await cached(`product:${id}:addons`, ["bd:catalog", `bd:product:${id}`], () =>
					bd.storefront.getProductAddons(id),
				);
				return jsonResponse(result);
			} catch (err) {
				return errResponse(err);
			}
		}

		// Static API routes.
		const route = routes[`${method} ${pathname}`];
		if (route) return route.handler(req);

		// Production: serve the Vite build. index.html gets JSON-LD injected;
		// unknown GET paths fall back to it for client-side routing.
		if (isProd && method === "GET") {
			if (pathname === "/" || !pathname.includes(".")) return serveIndexHtml(url.origin);
			const file = Bun.file(`./dist${pathname}`);
			if (await file.exists()) return new Response(file);
			return serveIndexHtml(url.origin);
		}
		return jsonResponse({ error: "Not found" }, 404);
	},
});

console.log(`[bd-proxy] Listening on http://localhost:${server.port}`);
if (!isProd) {
	console.log("[bd-proxy] Run `bun run dev:vite` for the SPA on :5173.");
}

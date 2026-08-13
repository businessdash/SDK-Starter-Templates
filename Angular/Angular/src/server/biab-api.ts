/**
 * BIAB server endpoints, mounted on the Express SSR app.
 *
 * These are the ONLY surfaces that touch the API key. The Angular browser
 * app calls them with plain `fetch` (see `src/app/lib/biab-api.client.ts`).
 * That keeps the key server-side while still giving the SPA live BIAB data
 * and cart/coupon/review mutations.
 *
 * Routes mounted:
 *   GET  /api/biab/home              marketing bundle → hero/about/services/
 *                                    reviews-config/banner/updates (cached)
 *   GET  /api/biab/blog              recent posts
 *   GET  /api/biab/store/products    storefront list (?cursor, ?categoryId)
 *   GET  /api/biab/store/products-meta filterable grid + facets (search,
 *                                    category, price, rating, sort, limit)
 *   GET  /api/biab/store/categories  product categories for the sidebar
 *   GET  /api/biab/store/products/:id  product detail
 *   GET  /api/biab/store/products/:id/reviews   approved reviews + aggregate
 *   GET  /api/biab/store/products/:id/related   "you may also like"
 *   GET  /api/biab/store/products/:id/addons    companion cross-sell rail
 *   GET  /api/biab/subscriptions     recurring offerings list
 *   GET  /api/biab/cart              current visitor cart snapshot
 *   POST /api/biab/cart/items        add item
 *   PATCH/api/biab/cart/items/:id    set quantity (0 removes)
 *   DELETE /api/biab/cart/items/:id  remove item
 *   POST /api/biab/cart/coupon       apply coupon
 *   DELETE /api/biab/cart/coupon     remove coupon
 *   POST /api/biab/cart/clear        empty cart
 *   POST /api/biab/checkout/start    → { url } Stripe Checkout
 *   POST /api/biab/contact           submit the contact form
 *   GET  /api/biab/reviews           reviews wall page (?offset, ?limit)
 *   GET  /api/biab/portal/me         signed-in customer + work bundle
 *   POST /api/biab/portal/review     submit a customer review
 *   POST /api/biab/services/:service/:area  parallel-page render
 *   ALL  /api/biab-auth/{*splat}     WorkOS auth handler (sign-in/out/callback…)
 *   POST /api/biab/revalidate        BIAB → consumer cache-purge webhook
 *   GET  /sitemap.xml, /robots.txt   proxied from the BIAB platform
 *
 * Every handler degrades gracefully when BIAB env is unset.
 */

import type { Express, Request as ExRequest, Response as ExResponse } from "express";
import express from "express";
import { randomUUID } from "node:crypto";
import { createAuthHandler } from "@businessdash/sdk";
import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";
import { llmsTxtHandler } from "@businessdash/sdk/distribution";
import { mcpHandler, mcpManifestHandler } from "@businessdash/sdk/mcp";

import {
	TODOS_OBJECT_ID,
	TODO_IMAGES_OBJECT_ID,
	TODO_FORM_SLUG,
} from "../../biab.data-model.config";
import {
	getBiab,
	getBiabDataModel,
	getBiabEnv,
	getBiabHostBase,
	cached,
	invalidateTags,
	runGuarded,
	getPageBundle,
	sectionData,
	readSession,
	portalForSession,
	SESSION_COOKIE,
	VISITOR_COOKIE,
	VISITOR_MAX_AGE_SECONDS,
} from "./biab-server";

// ── Cookie helpers (no cookie-parser dependency) ───────────────────

function readCookie(req: ExRequest, name: string): string | null {
	const header = req.headers.cookie;
	if (!header) return null;
	for (const part of header.split(";")) {
		const idx = part.indexOf("=");
		if (idx === -1) continue;
		if (part.slice(0, idx).trim() === name) {
			return decodeURIComponent(part.slice(idx + 1).trim());
		}
	}
	return null;
}

function setVisitorCookie(res: ExResponse, token: string): void {
	res.append(
		"Set-Cookie",
		`${VISITOR_COOKIE}=${token}; Path=/; HttpOnly; SameSite=Lax; Max-Age=${VISITOR_MAX_AGE_SECONDS}`,
	);
}

/** Read the visitor token, minting + persisting one on first mutation. */
function ensureVisitorToken(req: ExRequest, res: ExResponse): string {
	const existing = readCookie(req, VISITOR_COOKIE);
	if (existing) return existing;
	const token = randomUUID();
	setVisitorCookie(res, token);
	return token;
}

// ── Web Request <-> Node bridge (for the auth handler) ─────────────
//
// createAuthHandler returns web-standard (request: Request) => Response
// handlers. We build a web Request from the Express req, run the handler,
// then write the web Response back to the Express res — preserving the
// 302 redirects and Set-Cookie headers the WorkOS flow depends on.

function nodeToWebRequest(req: ExRequest): Request {
	const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
	const host = req.headers.host ?? "localhost";
	const url = `${proto}://${host}${req.originalUrl}`;
	const headers = new Headers();
	for (const [k, v] of Object.entries(req.headers)) {
		if (Array.isArray(v)) v.forEach((vv) => headers.append(k, vv));
		else if (v != null) headers.set(k, v);
	}
	const hasBody = req.method !== "GET" && req.method !== "HEAD";
	return new Request(url, {
		method: req.method,
		headers,
		body: hasBody && req.body != null ? bodyToString(req.body) : undefined,
	});
}

function bodyToString(body: unknown): string | undefined {
	if (body == null) return undefined;
	if (typeof body === "string") return body;
	if (Buffer.isBuffer(body)) return body.toString("utf8");
	try {
		return JSON.stringify(body);
	} catch {
		return undefined;
	}
}

async function writeWebResponse(web: Response, res: ExResponse): Promise<void> {
	res.status(web.status);
	web.headers.forEach((value, key) => {
		// Set-Cookie can repeat; append rather than overwrite.
		if (key.toLowerCase() === "set-cookie") res.append("Set-Cookie", value);
		else res.setHeader(key, value);
	});
	const text = await web.text();
	res.send(text);
}

// ── Bundle → home payload (presentation-friendly, server-mapped) ───

async function buildHomePayload() {
	const bundle = await getPageBundle("home", "en");
	if (!bundle) return { configured: false } as const;

	const hero = sectionData<{
		headline?: string;
		subheadline?: string;
		ctaText?: string;
		ctaLink?: string;
	}>(bundle, "hero");
	const about = sectionData<{ heading?: string; body?: string }>(bundle, "about");
	const services = sectionData<{
		heading?: string;
		items?: Array<{ type: string; description: string; link?: string }>;
	}>(bundle, "services");
	const reviewsCfg = sectionData<{ heading?: string; subheading?: string }>(
		bundle,
		"reviews",
	);

	// banner + updates are typed passthroughs on the bundle (0.9.5+).
	const banner = (bundle as { banner?: unknown }).banner ?? null;
	const updates = (bundle as { updates?: { items?: unknown[] } }).updates ?? null;
	const reviews = (bundle as { reviews?: unknown }).reviews ?? null;

	return {
		configured: true,
		hero,
		about,
		services,
		reviewsCfg,
		banner,
		updates: updates?.items ?? [],
		reviews,
		seo: (bundle as { seo?: unknown }).seo ?? null,
	};
}

// ── Mount everything onto the app ──────────────────────────────────

export function mountBiabApi(app: Express): void {
	const env = getBiabEnv();

	// The revalidate webhook's HMAC is computed over the RAW request body,
	// so capture it verbatim BEFORE the JSON parser would mutate it. We mount
	// this route here (ahead of express.json) and store the exact bytes.
	if (env?.revalidationSecret) {
		const revalidate = createGenericRevalidateHandler({
			secret: env.revalidationSecret,
			onTagsRevalidated: (tags) => {
				invalidateTags(tags);
			},
		});
		app.post(
			"/api/biab/revalidate",
			express.text({ type: "*/*" }),
			async (req, res) => {
				const raw = typeof req.body === "string" ? req.body : "";
				const sig = (req.headers["x-biab-signature"] as string) ?? "";
				const web = new Request(
					`http://localhost${req.originalUrl}`,
					{ method: "POST", headers: { "x-biab-signature": sig }, body: raw },
				);
				const out = await revalidate(web);
				await writeWebResponse(out, res);
			},
		);
	} else {
		app.post("/api/biab/revalidate", (_req, res) => {
			res.status(503).json({ ok: false, reason: "revalidation_secret_unset" });
		});
	}

	app.use(express.json());
	app.use(express.urlencoded({ extended: false }));

	// ---- Public config (browser-safe; NEVER the server API key) -----
	// Analytics posts from the browser and needs a key for the ingest
	// endpoint. We deliberately keep the powerful server key out of the
	// bundle and expose ONLY an explicitly-public, write-scoped analytics
	// key (set BIAB_PUBLIC_ANALYTICS_KEY if you want client analytics).
	// Unset → analytics quietly stays off.
	app.get("/api/biab/public-config", (_req, res) => {
		const e = getBiabEnv();
		const analyticsKey = process.env["BIAB_PUBLIC_ANALYTICS_KEY"] || null;
		if (!e || !analyticsKey) {
			res.json({ analytics: null });
			return;
		}
		res.json({
			analytics: { siteId: e.siteId, baseUrl: e.baseUrl, apiKey: analyticsKey },
		});
	});

	// ---- Home / marketing bundle ------------------------------------
	app.get("/api/biab/home", async (_req, res) => {
		const result = await runGuarded(buildHomePayload);
		if (!result.ok && result.suspended) {
			res.status(503).json({ unavailable: true, reason: result.reason });
			return;
		}
		res.json(result.ok ? result.data : { configured: false });
	});

	// ---- Blog -------------------------------------------------------
	app.get("/api/biab/blog", async (_req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ items: [] });
			return;
		}
		const env = getBiabEnv()!;
		const out = await runGuarded(() =>
			cached(`blog:${env.siteId}`, ["biab:blog"], () =>
				biab.blog.listPosts({ limit: 6 }),
			),
		);
		res.json(out.ok ? { items: out.data.items } : { items: [] });
	});

	// ---- Storefront -------------------------------------------------
	app.get("/api/biab/store/products", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ items: [], nextCursor: null, configured: false });
			return;
		}
		const env = getBiabEnv()!;
		const cursor = req.query["cursor"] ? Number(req.query["cursor"]) : undefined;
		const categoryId = (req.query["categoryId"] as string) || undefined;
		const out = await runGuarded(() =>
			cached(
				`products:${env.siteId}:${cursor ?? 0}:${categoryId ?? ""}`,
				["biab:catalog"],
				() => biab.storefront.listProducts({ limit: 12, cursor, categoryId }),
			),
		);
		if (!out.ok && out.suspended) {
			res.status(503).json({ unavailable: true, reason: out.reason });
			return;
		}
		res.json(out.ok ? { ...out.data, configured: true } : { items: [], nextCursor: null });
	});

	// Filterable listing grid + facets (categoryCounts, priceRange) + richer
	// per-card price/ratings/badges — the data behind the platform-style shop.
	// Reads search/categoryId/minPriceCents/maxPriceCents/minRating/sort/limit
	// from the query string and degrades to an empty facet shape on error.
	app.get("/api/biab/store/products-meta", async (req, res) => {
		const biab = getBiab();
		const empty = {
			items: [],
			categoryCounts: [],
			priceRange: { minDollars: 0, maxDollars: 0 },
		};
		if (!biab) {
			res.json({ ...empty, configured: false });
			return;
		}
		const env = getBiabEnv()!;
		const q = req.query;
		const search = (q["search"] as string) || undefined;
		const categoryId = (q["categoryId"] as string) || undefined;
		const minPriceCents = q["minPriceCents"] ? Number(q["minPriceCents"]) : undefined;
		const maxPriceCents = q["maxPriceCents"] ? Number(q["maxPriceCents"]) : undefined;
		const minRating = q["minRating"] ? Number(q["minRating"]) : undefined;
		const sortRaw = (q["sort"] as string) || undefined;
		const sorts = ["featured", "newest", "price-asc", "price-desc", "rating-desc"] as const;
		const sort = sorts.find((s) => s === sortRaw);
		const limit = q["limit"] ? Number(q["limit"]) : 24;
		const key = `products-meta:${env.siteId}:${search ?? ""}:${categoryId ?? ""}:${minPriceCents ?? ""}:${maxPriceCents ?? ""}:${minRating ?? ""}:${sort ?? ""}:${limit}`;
		const out = await runGuarded(() =>
			cached(key, ["biab:catalog"], () =>
				biab.storefront.listProductsWithMeta({
					limit,
					...(search ? { search } : {}),
					...(categoryId ? { categoryId } : {}),
					...(minPriceCents != null ? { minPriceCents } : {}),
					...(maxPriceCents != null ? { maxPriceCents } : {}),
					...(minRating != null ? { minRating } : {}),
					...(sort ? { sort } : {}),
				}),
			),
		);
		if (!out.ok && out.suspended) {
			res.status(503).json({ unavailable: true, reason: out.reason });
			return;
		}
		res.json(out.ok ? { ...out.data, configured: true } : empty);
	});

	// Product categories for the storefront sidebar (id + name + description).
	app.get("/api/biab/store/categories", async (_req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ items: [] });
			return;
		}
		const env = getBiabEnv()!;
		const out = await runGuarded(() =>
			cached(`categories:${env.siteId}`, ["biab:catalog"], () =>
				biab.storefront.listCategories(),
			),
		);
		res.json(out.ok ? out.data : { items: [] });
	});

	app.get("/api/biab/store/products/:id", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(404).json({ error: "unconfigured" });
			return;
		}
		const out = await runGuarded(() => biab.storefront.getProduct(req.params["id"]));
		if (out.ok) res.json(out.data);
		else res.status(out.suspended ? 503 : 404).json({ error: out.reason });
	});

	// Approved reviews + aggregate (avgRating, totalCount) for one product.
	app.get("/api/biab/store/products/:id/reviews", async (req, res) => {
		const biab = getBiab();
		const empty = { items: [], nextCursor: null, avgRating: 0, totalCount: 0 };
		if (!biab) {
			res.json(empty);
			return;
		}
		const limit = req.query["limit"] ? Number(req.query["limit"]) : 20;
		const out = await runGuarded(() =>
			biab.storefront.getProductReviews(req.params["id"], { limit }),
		);
		res.json(out.ok ? out.data : empty);
	});

	// "You may also like" recommendations for one product.
	app.get("/api/biab/store/products/:id/related", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ items: [] });
			return;
		}
		const limit = req.query["limit"] ? Number(req.query["limit"]) : 6;
		const out = await runGuarded(() =>
			biab.storefront.getRelatedProducts(req.params["id"], { limit }),
		);
		res.json(out.ok ? out.data : { items: [] });
	});

	// Companion / cross-sell addons ("complete your X") for one product.
	app.get("/api/biab/store/products/:id/addons", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ items: [] });
			return;
		}
		const out = await runGuarded(() =>
			biab.storefront.getProductAddons(req.params["id"]),
		);
		res.json(out.ok ? out.data : { items: [] });
	});

	// ---- Subscriptions ----------------------------------------------
	app.get("/api/biab/subscriptions", async (_req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ items: [], configured: false });
			return;
		}
		const env = getBiabEnv()!;
		const out = await runGuarded(() =>
			cached(`subs:${env.siteId}`, ["biab:catalog"], () =>
				biab.subscriptions.list(),
			),
		);
		res.json(out.ok ? { ...out.data, configured: true } : { items: [] });
	});

	// ---- Cart -------------------------------------------------------
	app.get("/api/biab/cart", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json(null);
			return;
		}
		const token = readCookie(req, VISITOR_COOKIE);
		if (!token) {
			res.json(null); // no cart yet — nothing minted
			return;
		}
		const out = await runGuarded(() => biab.cart.forVisitor(token).get());
		res.json(out.ok ? out.data : null);
	});

	app.post("/api/biab/cart/items", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(503).json({ error: "unconfigured" });
			return;
		}
		const token = ensureVisitorToken(req, res);
		const out = await runGuarded(() =>
			biab.cart.forVisitor(token).addItem({
				productId: String(req.body?.productId ?? ""),
				...(req.body?.variantId ? { variantId: String(req.body.variantId) } : {}),
				quantity: Number(req.body?.quantity ?? 1),
			}),
		);
		if (out.ok) res.json(out.data);
		else res.status(400).json({ error: out.reason });
	});

	app.patch("/api/biab/cart/items/:id", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(503).json({ error: "unconfigured" });
			return;
		}
		const token = ensureVisitorToken(req, res);
		const out = await runGuarded(() =>
			biab.cart
				.forVisitor(token)
				.updateItem(req.params["id"], { quantity: Number(req.body?.quantity ?? 0) }),
		);
		if (out.ok) res.json(out.data);
		else res.status(400).json({ error: out.reason });
	});

	app.delete("/api/biab/cart/items/:id", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(503).json({ error: "unconfigured" });
			return;
		}
		const token = ensureVisitorToken(req, res);
		const out = await runGuarded(() =>
			biab.cart.forVisitor(token).removeItem(req.params["id"]),
		);
		if (out.ok) res.json(out.data);
		else res.status(400).json({ error: out.reason });
	});

	app.post("/api/biab/cart/coupon", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(503).json({ error: "unconfigured" });
			return;
		}
		const token = ensureVisitorToken(req, res);
		const out = await runGuarded(() =>
			biab.cart.forVisitor(token).applyCoupon({ code: String(req.body?.code ?? "") }),
		);
		if (out.ok) res.json(out.data);
		else res.status(400).json({ error: out.reason });
	});

	app.delete("/api/biab/cart/coupon", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(503).json({ error: "unconfigured" });
			return;
		}
		const token = ensureVisitorToken(req, res);
		const out = await runGuarded(() => biab.cart.forVisitor(token).removeCoupon());
		if (out.ok) res.json(out.data);
		else res.status(400).json({ error: out.reason });
	});

	app.post("/api/biab/cart/clear", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(503).json({ error: "unconfigured" });
			return;
		}
		const token = ensureVisitorToken(req, res);
		const out = await runGuarded(() => biab.cart.forVisitor(token).clear());
		if (out.ok) res.json(out.data);
		else res.status(400).json({ error: out.reason });
	});

	// ---- Checkout ---------------------------------------------------
	app.post("/api/biab/checkout/start", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(503).json({ error: "unconfigured" });
			return;
		}
		const token = readCookie(req, VISITOR_COOKIE);
		if (!token) {
			res.status(400).json({ error: "empty_cart" });
			return;
		}
		const proto = (req.headers["x-forwarded-proto"] as string) || req.protocol || "http";
		const origin = `${proto}://${req.headers.host ?? "localhost"}`;
		const out = await runGuarded(() =>
			biab.checkout.forVisitor(token).start({
				successUrl: `${origin}/cart?status=success`,
				cancelUrl: `${origin}/cart?status=cancel`,
			}),
		);
		if (out.ok) res.json({ url: out.data.stripeUrl });
		else res.status(400).json({ error: out.reason });
	});

	// ---- Contact form -----------------------------------------------
	app.post("/api/biab/contact", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ ok: true, demo: true });
			return;
		}
		const out = await runGuarded(() =>
			biab.forms.submit(
				String(req.body?.slug ?? "general-inquiry"),
				{
					name: req.body?.name,
					email: req.body?.email,
					message: req.body?.message,
				},
				{ submitterEmail: req.body?.email, submitterName: req.body?.name },
			),
		);
		if (out.ok) res.json({ ok: true });
		else res.status(400).json({ ok: false, error: out.reason });
	});

	// ---- Generic forms (drives the <biab-form> drop-in component) ---
	//
	// The <biab-form> Angular component (from @businessdash/sdk/angular) renders any
	// dashboard-built form by slug. It needs (1) the published schema to render
	// the field tree and (2) a submit endpoint. Both stay server-side so the
	// per-site API key never reaches the browser — the browser talks only to
	// these two local proxies. The component is pointed at them by the thin
	// adapter in `src/app/lib/biab-forms.client.ts`.
	app.get("/api/biab/forms/:slug/schema", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(404).json({ error: "not_configured" });
			return;
		}
		const slug = String(req.params["slug"]);
		const env = getBiabEnv()!;
		const out = await runGuarded(() =>
			cached(`form-schema:${env.siteId}:${slug}`, ["biab:forms", `biab:forms:${slug}`], () =>
				biab.forms.schema(slug),
			),
		);
		if (out.ok) res.json(out.data);
		else res.status(400).json({ error: out.reason });
	});

	app.post("/api/biab/forms/:slug/submit", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			// Unconfigured site: confirm without storing so the demo still works.
			res.json({ ok: true, status: 200, dryRun: true });
			return;
		}
		const slug = String(req.params["slug"]);
		const body = (req.body ?? {}) as {
			data?: Record<string, unknown>;
			submitterEmail?: string;
			submitterName?: string;
			dryRun?: boolean;
			source?: string;
			referrer?: string;
			metadata?: Record<string, unknown>;
		};
		// forms.submit never throws for an expected failure — it resolves to a
		// FormSubmitResult. Pass it straight back so the component can render
		// success or the exact field-level problem inline.
		const result = await biab.forms.submit(slug, body.data ?? {}, {
			...(body.submitterEmail ? { submitterEmail: body.submitterEmail } : {}),
			...(body.submitterName ? { submitterName: body.submitterName } : {}),
			...(body.dryRun ? { dryRun: true } : {}),
			...(body.source ? { source: body.source } : {}),
			...(body.referrer ? { referrer: body.referrer } : {}),
			...(body.metadata ? { metadata: body.metadata } : {}),
		});
		res.status(result.ok ? 200 : result.status || 400).json(result);
	});

	// ---- Todos (relational custom-collections demo) -----------------
	//
	// `biab.data-model.config.ts` declares `todos` plus `todoImages`, whose
	// `todo` field is a RELATION back to `todos`.
	//
	// READ: the SDK's documented custom-database read path —
	// `dataModel.listRecords({ object })` — for both collections, joined here.
	// Relations come back as LINKS (`relations.todo` on each image is
	// `[{ recordId, object }]`, not an embedded row), so the join groups
	// images by the todo record they point at.
	//
	// WRITE: POST submits the generated "Todo Form" via `biab.forms.submit` —
	// forms are the SDK's documented create path for custom collections;
	// there is no direct row-write surface.
	app.get("/api/biab/todos", async (_req, res) => {
		const dataModel = getBiabDataModel();
		if (!dataModel) {
			res.json({
				available: false,
				reason: "BIAB isn't configured — see .env.example.",
				todos: [],
			});
			return;
		}
		const asOptionalText = (value: unknown): string | null =>
			typeof value === "string" && value.length > 0 ? value : null;
		try {
			const [todosRes, imagesRes] = await Promise.all([
				dataModel.listRecords({ object: TODOS_OBJECT_ID, limit: 50 }),
				dataModel.listRecords({ object: TODO_IMAGES_OBJECT_ID, limit: 200 }),
			]);
			if (!todosRes.available || !imagesRes.available) {
				res.json({
					available: false,
					reason:
						"Custom objects aren't available on this org's plan, or the model hasn't been promoted yet.",
					todos: [],
				});
				return;
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
			res.json({
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
			res.json({
				available: false,
				reason: err instanceof Error ? err.message : "Couldn't read todos.",
				todos: [],
			});
		}
	});

	app.post("/api/biab/todos", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(503).json({
				ok: false,
				message: "BIAB isn't configured — see .env.example.",
			});
			return;
		}
		const title = String(req.body?.title ?? "").trim();
		const notes = String(req.body?.notes ?? "").trim();
		if (!title) {
			res.status(400).json({ ok: false, message: "Title is required." });
			return;
		}
		// Keyed by each field's output key — `validateFormSubmission` accepts
		// output keys (preferred) or legacy field ids.
		const result = await biab.forms.submit(TODO_FORM_SLUG, {
			title,
			...(notes ? { notes } : {}),
		});
		if (!result.ok) {
			res.status(result.status >= 400 ? result.status : 400).json({
				ok: false,
				message:
					result.reason === "not_found"
						? 'Couldn\'t add that todo — is the generated "Todo Form" Live?'
						: result.message,
			});
			return;
		}
		res.json({ ok: true });
	});

	// ---- Reviews wall (aggregate + paginated) -----------------------
	app.get("/api/biab/reviews", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ items: [], totalCount: 0, nextOffset: null });
			return;
		}
		const offset = req.query["offset"] ? Number(req.query["offset"]) : undefined;
		const limit = req.query["limit"] ? Number(req.query["limit"]) : 10;
		const env = getBiabEnv()!;
		const out = await runGuarded(() =>
			cached(
				`reviews:${env.siteId}:${offset ?? 0}:${limit}`,
				["biab:reviews"],
				() => biab.reviews.list({ limit, ...(offset !== undefined ? { offset } : {}) }),
			),
		);
		res.json(out.ok ? out.data : { items: [], totalCount: 0, nextOffset: null });
	});

	// ---- Scheduling / booking ---------------------------------------
	app.get("/api/biab/scheduling/event-types", async (_req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ items: [] });
			return;
		}
		const env = getBiabEnv()!;
		const out = await runGuarded(() =>
			cached(`sched:${env.siteId}`, ["biab:scheduling"], () =>
				biab.scheduling.listEventTypes(),
			),
		);
		res.json({ items: out.ok ? out.data : [] });
	});

	app.get("/api/biab/scheduling/:slug/slots", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ slots: [] });
			return;
		}
		const fromRaw = req.query["from"] as string | undefined;
		const toRaw = req.query["to"] as string | undefined;
		const from = fromRaw ? new Date(fromRaw) : new Date();
		const to = toRaw ? new Date(toRaw) : new Date(Date.now() + 1000 * 60 * 60 * 24 * 14);
		const out = await runGuarded(() =>
			biab.scheduling.getAvailableSlots(req.params["slug"], { from, to }),
		);
		res.json({ slots: out.ok ? out.data : [] });
	});

	app.post("/api/biab/scheduling/:slug/book", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(503).json({ error: "unconfigured" });
			return;
		}
		const out = await runGuarded(() =>
			biab.scheduling.confirmBooking({
				eventTypeSlug: req.params["slug"],
				startAt: new Date(String(req.body?.startAt ?? "")),
				invitee: {
					email: String(req.body?.email ?? ""),
					name: String(req.body?.name ?? ""),
					phone: req.body?.phone ? String(req.body.phone) : null,
					timezone:
						String(req.body?.timezone ?? "") ||
						Intl.DateTimeFormat().resolvedOptions().timeZone,
				},
				...(req.body?.notes ? { notes: String(req.body.notes) } : {}),
			}),
		);
		if (out.ok) res.json({ ok: true, status: out.data.status, bookingId: out.data.bookingId });
		else res.status(400).json({ ok: false, error: out.reason });
	});

	// ---- Customer portal --------------------------------------------
	app.get("/api/biab/portal/me", async (req, res) => {
		const session = await readSession(readCookie(req, SESSION_COOKIE));
		if (!session) {
			res.json({ signedIn: false });
			return;
		}
		const portal = portalForSession(session.organizationId, session.token);
		const work = portal
			? await runGuarded(() => portal.getWork())
			: ({ ok: false, suspended: false, reason: "unconfigured" } as const);
		res.json({
			signedIn: true,
			user: session.user,
			organizationId: session.organizationId,
			role: session.role,
			work: work.ok ? work.data : null,
		});
	});

	app.post("/api/biab/portal/review", async (req, res) => {
		const session = await readSession(readCookie(req, SESSION_COOKIE));
		if (!session) {
			res.status(401).json({ error: "sign_in_required" });
			return;
		}
		const portal = portalForSession(session.organizationId, session.token);
		if (!portal) {
			res.status(503).json({ error: "unconfigured" });
			return;
		}
		const out = await runGuarded(() =>
			portal.submitReview({
				rating: Number(req.body?.rating ?? 5),
				...(req.body?.title ? { title: String(req.body.title) } : {}),
				body: String(req.body?.body ?? ""),
				...(req.body?.jobId ? { jobId: String(req.body.jobId) } : {}),
			}),
		);
		if (out.ok) res.json({ ok: true, status: out.data.status ?? "pending" });
		else res.status(400).json({ ok: false, error: out.reason });
	});

	// ---- Parallel page render (service × area) ----------------------
	app.get("/api/biab/services/:service/:area", async (req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.status(404).json({ error: "unconfigured" });
			return;
		}
		const { service, area } = req.params;
		const env = getBiabEnv()!;
		const out = await runGuarded(() =>
			cached(
				`pp:${env.siteId}:service-area:${service}:${area}`,
				["biab:parallel-pages"],
				() => biab.parallelPages.render("service-area", { service, area }),
			),
		);
		if (out.ok) res.json(out.data);
		else res.status(out.suspended ? 503 : 404).json({ error: out.reason });
	});

	// List the (service × area) variants for the index page.
	app.get("/api/biab/services", async (_req, res) => {
		const biab = getBiab();
		if (!biab) {
			res.json({ variants: [] });
			return;
		}
		const env = getBiabEnv()!;
		const out = await runGuarded(() =>
			cached(`ppv:${env.siteId}:service-area`, ["biab:parallel-pages"], () =>
				biab.parallelPages.listVariants("service-area"),
			),
		);
		res.json(out.ok ? out.data : { variants: [] });
	});

	// ---- Auth handler (WorkOS) --------------------------------------
	if (env?.authCallbackUrl) {
		const auth = createAuthHandler({
			baseUrl: env.baseUrl,
			apiKey: env.apiKey,
			callbackUrl: env.authCallbackUrl,
			basePath: "/api/biab-auth",
			defaultReturnTo: "/my-account",
			signOutReturnTo: "/",
		});
		const authBridge = (handler: (r: Request) => Promise<Response>) =>
			async (req: ExRequest, res: ExResponse) => {
				const web = await handler(nodeToWebRequest(req));
				await writeWebResponse(web, res);
			};
		app.get(/^\/api\/biab-auth(\/.*)?$/, authBridge(auth.GET));
		app.post(/^\/api\/biab-auth(\/.*)?$/, authBridge(auth.POST));
	} else {
		// Unconfigured: answer auth probes with a clear 503 instead of SSR HTML.
		app.all(/^\/api\/biab-auth(\/.*)?$/, (_req, res) => {
			res.status(503).json({ error: "auth_unconfigured" });
		});
	}

	// (The revalidate webhook is mounted at the top of this function so its
	// raw body is captured before the JSON parser runs — see above.)

	// ---- SEO proxies ------------------------------------------------
	app.get("/sitemap.xml", async (_req, res) => {
		const biab = getBiab();
		const e = getBiabEnv();
		if (!biab || !e) {
			res.status(200).type("application/xml").send(
				`<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>`,
			);
			return;
		}
		const url = `${e.baseUrl.replace(/\/$/, "")}/${biab.parallelPages.sitemapUrl()}`;
		try {
			const upstream = await fetch(url, {
				headers: { Authorization: `Bearer ${e.apiKey}` },
			});
			res.status(upstream.status)
				.type(upstream.headers.get("content-type") ?? "application/xml")
				.send(await upstream.text());
		} catch {
			res.status(502).type("application/xml").send("");
		}
	});

	app.get("/robots.txt", async (_req, res) => {
		const biab = getBiab();
		const e = getBiabEnv();
		if (!biab || !e) {
			res.status(200).type("text/plain").send("User-agent: *\nAllow: /\n");
			return;
		}
		const url = `${e.baseUrl.replace(/\/$/, "")}/${biab.parallelPages.robotsUrl()}`;
		try {
			const upstream = await fetch(url, {
				headers: { Authorization: `Bearer ${e.apiKey}` },
			});
			res.status(upstream.status)
				.type(upstream.headers.get("content-type") ?? "text/plain")
				.send(await upstream.text());
		} catch {
			res.status(502).type("text/plain").send("User-agent: *\nAllow: /\n");
		}
	});

	// ---- AI surfaces: llms.txt + MCP connector (SDK 0.9.53) ---------
	//
	// AEO (answer-engine optimization): `/llms.txt` serves the org-curated
	// artifact from THIS domain's root — the only place AI crawlers look for
	// it — while the source of truth stays on BIAB (Dashboard → Marketing →
	// AI Distribution). `/api/mcp` + `/.well-known/mcp.json` give this domain
	// the site's MCP connector: JSON-RPC proxied verbatim, with the platform
	// still enforcing the org's MCP opt-in + per-tool write gates. All three
	// take the BIAB app ORIGIN (host root), not the package API base. The
	// companion PRODUCT FEED needs no proxy — build its URL with
	// `productFeedUrl` from `@businessdash/sdk/distribution` and submit it to
	// merchant/feed programs. The SDK handlers are web-standard
	// `Request → Response`; we bridge to Express the same way as the auth
	// handler above.
	const aiHost = getBiabHostBase();
	const aiSiteId = getBiabEnv()?.siteId;
	if (aiHost && aiSiteId) {
		const aiOptions = { siteId: aiSiteId, baseUrl: aiHost };
		const llmsTxt = llmsTxtHandler(aiOptions);
		const mcp = mcpHandler(aiOptions);
		const mcpManifest = mcpManifestHandler(aiOptions);

		app.get("/llms.txt", async (_req, res) => {
			await writeWebResponse(await llmsTxt(), res);
		});
		app.post("/api/mcp", async (req, res) => {
			await writeWebResponse(await mcp.POST(nodeToWebRequest(req)), res);
		});
		app.get("/api/mcp", async (_req, res) => {
			await writeWebResponse(await mcp.GET(), res);
		});
		app.get("/.well-known/mcp.json", async (req, res) => {
			await writeWebResponse(await mcpManifest(nodeToWebRequest(req)), res);
		});
	} else {
		app.get("/llms.txt", (_req, res) => {
			res.status(404).type("text/plain").send("llms.txt is not configured.\n");
		});
		app.all(["/api/mcp", "/.well-known/mcp.json"], (_req, res) => {
			res.status(503).json({ error: "MCP is not configured." });
		});
	}
}

/**
 * HTMX starter — Bun HTTP server that returns HTML fragments per section, plus
 * fully server-rendered feature pages. The browser loads `public/index.html`,
 * HTMX fires `hx-get` against `/sections/*` on body load, and `/store`,
 * `/cart`, `/my-account`, etc. are whole documents rendered server-side with
 * the BIAB SDK. No client JS framework.
 *
 * Feature parity with the reference consumer (BIAB SDK 0.9.5): storefront,
 * visitor-token cart + checkout, subscriptions, customer portal + auth,
 * reviews wall, news banner + updates, programmatic-SEO parallel pages,
 * sitemap/robots, JSON-LD, and a cache-backed revalidation webhook.
 */

import { llmsTxtHandler } from "@businessdash/sdk/distribution";
import { mcpHandler, mcpManifestHandler } from "@businessdash/sdk/mcp";

import {
	ANALYTICS_PUBLIC,
	API_KEY,
	SITE_ID,
	authHandler,
	getBiab,
	hostBase,
	revalidateHandler,
} from "./src/biab";
import { VISITOR_COOKIE, SESSION_COOKIE, getCookie, renderBanner, setupBannerHtml } from "./src/layout";
import {
	cartPage,
	handleCartOp,
	myAccountPage,
	productPage,
	reviewsMore,
	reviewsPage,
	serviceAreaPage,
	servicesPage,
	storePage,
	subscriptionsPage,
	submitReviewFragment,
	todosCreateFragment,
	todosPage,
	updatesPage,
} from "./src/pages";
import { renderAbout } from "./src/sections/about";
import { renderBlog } from "./src/sections/blog";
import { renderFooter, renderHeader } from "./src/sections/header";
import { renderHero } from "./src/sections/hero";
import { renderServices } from "./src/sections/services";
import { handleSubscribe } from "./src/sections/subscribe";

const PORT = Number(process.env["PORT"] ?? 3000);

if (!ANALYTICS_PUBLIC.siteId) {
	console.warn(
		"\n[biab] Missing one of BIAB_API_KEY / BIAB_SITE_ID / BIAB_PACKAGE_API_BASE_URL.",
		"\n[biab] Set them in .env.local — sections render local fallbacks until then.\n",
	);
}

function htmlResponse(body: string, status = 200, headers: Record<string, string> = {}): Response {
	return new Response(body, {
		status,
		headers: { "Content-Type": "text/html; charset=utf-8", "Cache-Control": "no-store", ...headers },
	});
}

/**
 * Section fragment handlers — one entry per HTMX endpoint loaded into the home
 * shell. Each line is a URL `index.html` knows about + a render function.
 */
type Handler = (req: Request) => Promise<string> | string;

const sectionHandlers: Record<string, Handler> = {
	"GET /sections/header": () => renderHeader(),
	"GET /sections/hero": () => renderHero(),
	"GET /sections/about": (req) => renderAbout(req),
	"GET /sections/services": () => renderServices(),
	"GET /sections/blog": () => renderBlog(),
	"GET /sections/footer": (req) => renderFooter(req),
	"GET /sections/reviews-more": async (req) =>
		reviewsMore(Number(new URL(req.url).searchParams.get("offset") ?? 0)),
	"GET /sections/banner": () => renderBanner(),
};

function injectAnalyticsConfig(shell: string): string {
	if (!ANALYTICS_PUBLIC.siteId || !ANALYTICS_PUBLIC.baseUrl || !ANALYTICS_PUBLIC.apiKey) return shell;
	const config = JSON.stringify({
		siteId: ANALYTICS_PUBLIC.siteId,
		baseUrl: ANALYTICS_PUBLIC.baseUrl,
		apiKey: ANALYTICS_PUBLIC.apiKey,
	});
	return shell.replace("</body>", `<script>window.__BIAB_ANALYTICS__=${config};</script></body>`);
}

/** Inject the dismissable "not connected" setup banner into the static home
 *  shell (feature pages get it via `page()`). No-op once BIAB is configured. */
function injectSetupBanner(shell: string): string {
	const banner = setupBannerHtml();
	if (!banner) return shell;
	return shell.replace("</body>", `${banner}</body>`);
}

// ── SEO proxies (host root, not the package API path) ──────────────

async function proxySitemap(): Promise<Response> {
	const empty = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9"></urlset>\n`;
	if (!API_KEY || !SITE_ID || !hostBase) {
		return new Response(empty, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
	}
	try {
		const res = await fetch(`${hostBase}/sites/${encodeURIComponent(SITE_ID)}/sitemap.xml`, {
			headers: { Authorization: `Bearer ${API_KEY}` },
		});
		if (!res.ok) return new Response(empty, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
		return new Response(await res.text(), {
			headers: { "Content-Type": "application/xml; charset=utf-8", "Cache-Control": "public, max-age=60" },
		});
	} catch {
		return new Response(empty, { headers: { "Content-Type": "application/xml; charset=utf-8" } });
	}
}

// ── SDK forms stylesheet ───────────────────────────────────────────
// The SDK ships `biab-forms.css` (file-upload box, multi-step progress header,
// availability/choice chips). HTMX has no bundler, so we serve the file straight
// from node_modules and `<link>` it on form-bearing pages (see ./src/layout
// `page()` head + public/index.html). Graceful empty-string fallback so the
// template still boots before the SDK is installed.
const FORMS_CSS_FILE = Bun.file("./node_modules/@businessdash/sdk/dist/biab-forms.css");

async function serveFormsCss(): Promise<Response> {
	const body = (await FORMS_CSS_FILE.exists()) ? await FORMS_CSS_FILE.text() : "";
	return new Response(body, {
		headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=300" },
	});
}

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

const aiConfigured = Boolean(SITE_ID && hostBase);
const llmsTxt = aiConfigured
	? llmsTxtHandler({ siteId: SITE_ID as string, baseUrl: hostBase as string })
	: null;
const mcp = aiConfigured
	? mcpHandler({ siteId: SITE_ID as string, baseUrl: hostBase as string })
	: null;
const mcpManifest = aiConfigured
	? mcpManifestHandler({ siteId: SITE_ID as string, baseUrl: hostBase as string })
	: null;

async function proxyRobots(): Promise<Response> {
	const fallback = "User-agent: *\nAllow: /\n";
	if (!API_KEY || !SITE_ID || !hostBase) {
		return new Response(fallback, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}
	try {
		const res = await fetch(`${hostBase}/sites/${encodeURIComponent(SITE_ID)}/robots.txt`, {
			headers: { Authorization: `Bearer ${API_KEY}` },
		});
		if (!res.ok) return new Response(fallback, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
		return new Response(await res.text(), {
			headers: { "Content-Type": "text/plain; charset=utf-8", "Cache-Control": "public, max-age=60" },
		});
	} catch {
		return new Response(fallback, { headers: { "Content-Type": "text/plain; charset=utf-8" } });
	}
}

const server = Bun.serve({
	port: PORT,
	async fetch(req) {
		const url = new URL(req.url);
		const { pathname } = url;
		const method = req.method;

		// WorkOS auth — pass the web Request straight through (redirects + cookies).
		if (pathname === "/api/biab-auth" || pathname.startsWith("/api/biab-auth/")) {
			if (!authHandler) return htmlResponse(`<p class="error">Auth isn't configured.</p>`, 503);
			return method === "POST" ? authHandler.POST(req) : authHandler.GET(req);
		}

		// Publish webhook → busts the in-memory tag cache.
		if (method === "POST" && pathname === "/api/biab/revalidate") {
			if (!revalidateHandler) return htmlResponse("revalidation secret not set", 503);
			return revalidateHandler(req);
		}

		// SEO.
		if (method === "GET" && pathname === "/sitemap.xml") return proxySitemap();
		if (method === "GET" && pathname === "/robots.txt") return proxyRobots();

		// AI surfaces — llms.txt (AEO) + the MCP connector on this domain.
		if (method === "GET" && pathname === "/llms.txt") {
			if (!llmsTxt) return new Response("llms.txt is not configured.\n", { status: 404 });
			return llmsTxt();
		}
		if (pathname === "/api/mcp") {
			if (!mcp) return Response.json({ error: "MCP is not configured." }, { status: 503 });
			return method === "POST" ? mcp.POST(req) : mcp.GET();
		}
		if (method === "GET" && pathname === "/.well-known/mcp.json") {
			if (!mcpManifest) return Response.json({ error: "MCP is not configured." }, { status: 503 });
			return mcpManifest(req);
		}

		// SDK forms stylesheet (served from node_modules; <link>ed on form pages).
		if (method === "GET" && pathname === "/biab-forms.css") return serveFormsCss();

		// Same-origin proxy for the <biab-form> web component (the contact form).
		// The browser never sees the bearer key — these run server-side. GET the
		// schema, POST the submission (mirrors the Vanilla-JS starter).
		if (method === "GET" && pathname === "/api/biab/forms/schema") {
			const biab = getBiab();
			if (!biab)
				return Response.json({ error: "Not configured." }, { status: 503 });
			const slug = url.searchParams.get("slug");
			if (!slug)
				return Response.json({ error: "slug required" }, { status: 400 });
			try {
				return Response.json(await biab.forms.schema(slug));
			} catch (err) {
				return Response.json(
					{ error: err instanceof Error ? err.message : "Couldn't load form." },
					{ status: 502 },
				);
			}
		}
		if (method === "POST" && pathname === "/api/biab/forms/submit") {
			const biab = getBiab();
			if (!biab)
				return Response.json({ error: "Not configured." }, { status: 503 });
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
				return Response.json(result);
			} catch (err) {
				return Response.json(
					{ error: err instanceof Error ? err.message : "Submission failed." },
					{ status: 400 },
				);
			}
		}

		// Section fragments + reviews "load more".
		const sectionHandler = sectionHandlers[`${method} ${pathname}`];
		if (sectionHandler) {
			try {
				return htmlResponse(await sectionHandler(req));
			} catch (err) {
				console.error(`[biab] ${method} ${pathname} failed:`, err);
				return htmlResponse(`<p class="error">Couldn't load this section.</p>`, 500);
			}
		}

		// Cart mutations (HTMX fragments).
		const cartOps: Record<string, Parameters<typeof handleCartOp>[1]> = {
			"/cart/add": "add",
			"/cart/update": "update",
			"/cart/remove": "remove",
			"/cart/coupon": "coupon",
			"/cart/coupon/remove": "coupon-remove",
			"/cart/clear": "clear",
		};
		if (method === "POST" && pathname in cartOps) {
			const { body, setCookie, status } = await handleCartOp(req, cartOps[pathname]!);
			return htmlResponse(body, status ?? 200, setCookie ? { "Set-Cookie": setCookie } : {});
		}

		// Checkout → Stripe redirect.
		if (method === "POST" && pathname === "/cart/checkout") {
			const biab = getBiab();
			if (!biab) return htmlResponse(`<p class="error">Store not configured.</p>`, 503);
			const token = getCookie(req, VISITOR_COOKIE);
			if (!token) return Response.redirect(`${url.origin}/cart`, 303);
			try {
				const res = await biab.checkout.forVisitor(token).start({
					successUrl: `${url.origin}/store?session_id={CHECKOUT_SESSION_ID}`,
					cancelUrl: `${url.origin}/cart`,
				});
				return Response.redirect(res.stripeUrl, 303);
			} catch (err) {
				return htmlResponse(
					`<p class="error">Couldn't start checkout: ${err instanceof Error ? err.message : String(err)}</p>`,
					502,
				);
			}
		}

		// Customer review submit (HTMX fragment into #review-msg).
		if (method === "POST" && pathname === "/account/review") {
			return htmlResponse(await submitReviewFragment(req));
		}

		// Todos create (custom-collections demo) — hx-post re-renders the region.
		if (method === "POST" && pathname === "/todos") {
			return htmlResponse(await todosCreateFragment(req));
		}

		// Newsletter subscribe → followers.join (HTMX fragment; sets the
		// per-browser "already subscribed" hint cookie on success).
		if (method === "POST" && pathname === "/sections/subscribe") {
			const { body, setCookie, status } = await handleSubscribe(req);
			return htmlResponse(
				body,
				status ?? 200,
				setCookie ? { "Set-Cookie": setCookie } : {},
			);
		}

		// Feature pages (full documents).
		if (method === "GET") {
			const storeMatch = pathname.match(/^\/store\/([^/]+)$/);
			const svcMatch = pathname.match(/^\/services\/([^/]+)\/([^/]+)$/);
			if (pathname === "/store") return htmlResponse(await storePage(url, req.headers.get("HX-Request") === "true"));
			if (storeMatch) return htmlResponse(await productPage(url.origin, decodeURIComponent(storeMatch[1]!)));
			if (pathname === "/cart") return htmlResponse(await cartPage(url.origin, getCookie(req, VISITOR_COOKIE)));
			if (pathname === "/subscriptions") return htmlResponse(await subscriptionsPage(url.origin));
			if (pathname === "/reviews") return htmlResponse(await reviewsPage(url.origin));
			if (pathname === "/updates") return htmlResponse(await updatesPage(url.origin));
			if (pathname === "/todos") return htmlResponse(await todosPage(url.origin));
			if (pathname === "/services") return htmlResponse(await servicesPage(url.origin));
			if (svcMatch) return htmlResponse(await serviceAreaPage(url.origin, decodeURIComponent(svcMatch[1]!), decodeURIComponent(svcMatch[2]!)));
			if (pathname === "/my-account") return htmlResponse(await myAccountPage(url.origin, getCookie(req, SESSION_COOKIE)));
		}

		// Static files from ./public/ (index.html gets analytics injected).
		const path = pathname === "/" ? "/index.html" : pathname;
		const file = Bun.file(`./public${path}`);
		if (await file.exists()) {
			if (path.endsWith(".html")) {
				const text = await file.text();
				return htmlResponse(injectSetupBanner(injectAnalyticsConfig(text)));
			}
			return new Response(file);
		}

		return new Response("Not Found", { status: 404 });
	},
});

console.log(`[biab] HTMX starter listening on http://localhost:${server.port}`);

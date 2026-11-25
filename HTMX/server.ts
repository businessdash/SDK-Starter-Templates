/**
 * HTMX starter — Bun HTTP server that returns HTML fragments per section, plus
 * fully server-rendered feature pages. The browser loads `public/index.html`,
 * HTMX fires `hx-get` against `/sections/*` on body load, and the feature
 * pages (my account, reviews, updates, …) are whole documents rendered
 * server-side with the BD SDK. No client JS framework.
 *
 * Feature parity with the reference consumer (BD SDK 0.9.5): storefront,
 * visitor-token cart + checkout, subscriptions, customer portal + auth,
 * reviews wall, news banner + updates, programmatic-SEO parallel pages,
 * sitemap/robots, JSON-LD, and a cache-backed revalidation webhook.
 *
 * The store (src/store-pages.ts) and the blog (src/blog-pages.ts) render on
 * the server too; their interactive parts are custom elements (src/shop/),
 * which this server bundles and serves at /shop/*.js (src/elements.ts).
 */

import { llmsTxtHandler } from "@businessdash/sdk/distribution";
import { mcpHandler, mcpManifestHandler } from "@businessdash/sdk/mcp";

import {
	ANALYTICS_PUBLIC,
	API_KEY,
	SITE_ID,
	authHandler,
	getBd,
	getSession,
	hostBase,
	revalidateHandler,
} from "./src/bd";
import { VISITOR_COOKIE, SESSION_COOKIE, getCookie, renderBanner, setupBannerHtml } from "./src/layout";
import { reviewsMore, reviewsPage, writeReview } from "./src/reviews-page";
import {
	myAccountPage,
	signInPage,
	serviceAreaPage,
	servicesPage,
	// [bd:subscriptions]
	subscriptionsPage,
	// [/bd:subscriptions]
	submitReviewFragment,
	todosCreateFragment,
	todosPage,
	updatesPage,
} from "./src/pages";
// [bd:store]
import { addToCart, cartPage, comparePage, handleCartOp, productPage, storePage, wishlistPage } from "./src/store-pages";
// [/bd:store]
// [bd:blog]
import { blogIndexPage, blogPostPage, commentOnPost, likePost } from "./src/blog-pages";
// [/bd:blog]
// [bd:store,blog]
import { serveElements } from "./src/elements";
// [/bd:store,blog]
import { handleSignInCheck, handleSignInPost, safeNext, signInCss } from "./src/sign-in";
import { handleFormPost, renderForm } from "./src/form";
import { contactSection, formPage } from "./src/form-pages";
import {
	defaultQuizSource,
	handleQuizPost,
	practiceSource,
	QUIZ_RUN_COOKIE,
	type QuizResult,
	type QuizSource,
	quizDocument,
	quizPath,
	quizTimer,
	renderQuizPage,
} from "./src/quiz";
import { render } from "./src/html";
import { renderAbout } from "./src/sections/about";
// [bd:blog]
import { renderBlog } from "./src/sections/blog";
// [/bd:blog]
import { renderFooter, renderHeader } from "./src/sections/header";
import { renderHero } from "./src/sections/hero";
import { renderServices } from "./src/sections/services";
import { handleSubscribe } from "./src/sections/subscribe";

const PORT = Number(process.env["PORT"] ?? 3000);

if (!ANALYTICS_PUBLIC.siteId) {
	console.warn(
		"\n[bd] Missing one of BD_API_KEY / BD_SITE_ID / BD_PACKAGE_API_BASE_URL.",
		"\n[bd] Set them in .env.local — sections render local fallbacks until then.\n",
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
	// [bd:blog]
	"GET /sections/blog": () => renderBlog(),
	// [/bd:blog]
	"GET /sections/footer": (req) => renderFooter(req),
	"GET /sections/reviews-more": (req) => reviewsMore(new URL(req.url)),
	"GET /sections/banner": () => renderBanner(),
	"GET /sections/contact": () => contactSection(),
};

function injectAnalyticsConfig(shell: string): string {
	if (!ANALYTICS_PUBLIC.siteId || !ANALYTICS_PUBLIC.baseUrl || !ANALYTICS_PUBLIC.apiKey) return shell;
	const config = JSON.stringify({
		siteId: ANALYTICS_PUBLIC.siteId,
		baseUrl: ANALYTICS_PUBLIC.baseUrl,
		apiKey: ANALYTICS_PUBLIC.apiKey,
	});
	return shell.replace("</body>", `<script>window.__BD_ANALYTICS__=${config};</script></body>`);
}

/** Inject the dismissable "not connected" setup banner into the static home
 *  shell (feature pages get it via `page()`). No-op once BD is configured. */
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
// The SDK ships `bd-forms.css` (file-upload box, multi-step progress header,
// availability/choice chips). HTMX has no bundler, so we serve the file straight
// from node_modules and `<link>` it on form-bearing pages (see ./src/layout
// `page()` head + public/index.html). Graceful empty-string fallback so the
// template still boots before the SDK is installed.
const FORMS_CSS_FILE = Bun.file("./node_modules/@businessdash/sdk/dist/bd-forms.css");

async function serveFormsCss(): Promise<Response> {
	const body = (await FORMS_CSS_FILE.exists()) ? await FORMS_CSS_FILE.text() : "";
	return new Response(body, {
		headers: { "Content-Type": "text/css; charset=utf-8", "Cache-Control": "public, max-age=300" },
	});
}

// ── AI surfaces: llms.txt + MCP connector (SDK 0.9.53) ─────────────
// AEO (answer-engine optimization): `/llms.txt` serves the org-curated
// artifact from THIS domain's root — the only place AI crawlers look for it —
// while the source of truth stays on BD (Dashboard → Marketing → AI
// Distribution). `/api/mcp` + `/.well-known/mcp.json` give this domain the
// site's MCP connector: JSON-RPC proxied verbatim, with the platform still
// enforcing the org's MCP opt-in + per-tool write gates. All three take the
// BD app ORIGIN (`hostBase`), not the package API base. The companion
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
		if (pathname === "/api/bd-auth" || pathname.startsWith("/api/bd-auth/")) {
			if (!authHandler) return htmlResponse(`<p class="error">Auth isn't configured.</p>`, 503);
			return method === "POST" ? authHandler.POST(req) : authHandler.GET(req);
		}

		// Publish webhook → busts the in-memory tag cache.
		if (method === "POST" && pathname === "/api/bd/revalidate") {
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
		if (method === "GET" && pathname === "/bd-forms.css") return serveFormsCss();
		// The sign-in screen on /my-account, rendered here (src/sign-in.ts).
		if (method === "GET" && pathname === "/bd-sign-in.css") return signInCss();
		if (method === "POST" && pathname === "/my-account/sign-in/check") return handleSignInCheck(req);
		if (method === "POST" && pathname === "/my-account/sign-in")
			return handleSignInPost(req, url, (section) => signInPage(url.origin, section));

		// BusinessDash forms, rendered here (src/form.ts): the page, and each post
		// from it. htmx swaps the form in place; without JavaScript a post gets
		// the whole page back.
		const formMatch = pathname.match(/^\/forms\/([^/]+)$/);
		if (formMatch) {
			const slug = decodeURIComponent(formMatch[1]!);
			if (method === "POST") {
				const form = await handleFormPost(slug, req);
				if (req.headers.get("HX-Request") === "true") return htmlResponse(render(form));
				return htmlResponse(await formPage(url.origin, slug, form));
			}
			if (method === "GET") return htmlResponse(await formPage(url.origin, slug, await renderForm(slug)));
		}

		// BusinessDash quizzes, rendered here (src/quiz.ts): a practice quiz or
		// the sample at /quiz, an invitation at /quiz-invite/<token> (the link
		// BD's invite emails carry when this site is the quiz's invite domain),
		// and the running clock each page re-reads.
		const timerMatch = pathname.match(/^\/quiz-timer\/([^/]+)$/);
		if (method === "GET" && timerMatch) return quizTimer(timerMatch[1]!);
		const quizMatch = pathname.match(/^\/quiz(?:\/([^/]+))?$/);
		const inviteMatch = pathname.match(/^\/quiz-invite\/([^/]+)$/);
		const quizSource: QuizSource | null = inviteMatch
			? { kind: "invitation", token: decodeURIComponent(inviteMatch[1]!) }
			: quizMatch
				? quizMatch[1]
					? practiceSource(decodeURIComponent(quizMatch[1]))
					: defaultQuizSource()
				: null;
		if (quizSource && (method === "GET" || (method === "POST" && pathname !== "/quiz"))) {
			const visitor = {
				session: getCookie(req, SESSION_COOKIE),
				signInHref: `/my-account?next=${encodeURIComponent(quizPath(quizSource))}`,
				switchAccountHref: "/api/bd-auth/sign-out",
			};
			const result: QuizResult =
				method === "POST"
					? await handleQuizPost(quizSource, req, visitor)
					: await renderQuizPage(quizSource, visitor, getCookie(req, QUIZ_RUN_COOKIE));
			const headers: Record<string, string> = result.setCookie ? { "Set-Cookie": result.setCookie } : {};
			if (method === "POST" && req.headers.get("HX-Request") === "true") return htmlResponse(render(result.body), 200, headers);
			return htmlResponse(await quizDocument(url.origin, result), 200, headers);
		}

		// Section fragments + reviews "load more".
		const sectionHandler = sectionHandlers[`${method} ${pathname}`];
		if (sectionHandler) {
			try {
				return htmlResponse(await sectionHandler(req));
			} catch (err) {
				console.error(`[bd] ${method} ${pathname} failed:`, err);
				return htmlResponse(`<p class="error">Couldn't load this section.</p>`, 500);
			}
		}

		// [bd:store]
		// Add to cart, from the product page (JSON).
		if (method === "POST" && pathname === "/api/bd/cart/add") return addToCart(req);

		// Cart changes on /cart (HTMX fragments).
		const cartOps: Record<string, Parameters<typeof handleCartOp>[1]> = {
			"/cart/update": "update",
			"/cart/remove": "remove",
			"/cart/coupon": "coupon",
			"/cart/coupon/remove": "coupon-remove",
			"/cart/clear": "clear",
		};
		if (method === "POST" && pathname in cartOps) {
			const { body, status } = await handleCartOp(req, cartOps[pathname]!);
			return htmlResponse(body, status ?? 200);
		}

		// Checkout → Stripe redirect.
		if (method === "POST" && pathname === "/cart/checkout") {
			const bd = getBd();
			if (!bd) return htmlResponse(`<p class="error">Store not configured.</p>`, 503);
			const token = getCookie(req, VISITOR_COOKIE);
			if (!token) return Response.redirect(`${url.origin}/cart`, 303);
			try {
				const res = await bd.checkout.forVisitor(token).start({
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
		// [/bd:store]

		// Writing a review (JSON, for the signed-in customer).
		if (method === "POST" && pathname === "/reviews/write") return writeReview(req);

		// [bd:blog]
		// Likes and comments on a post (JSON, for the signed-in customer).
		const blogAction = method === "POST" ? pathname.match(/^\/blog\/([^/]+)\/(like|comment)$/) : null;
		if (blogAction) {
			const slug = decodeURIComponent(blogAction[1]!);
			return blogAction[2] === "like" ? likePost(req, slug) : commentOnPost(req, slug);
		}
		// [/bd:blog]

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
			const svcMatch = pathname.match(/^\/services\/([^/]+)\/([^/]+)$/);
			// [bd:store,blog]
			if (pathname.startsWith("/shop/")) {
				const elements = await serveElements(pathname);
				if (elements) return elements;
			}
			// [/bd:store,blog]
			// [bd:store]
			const visitor = getCookie(req, VISITOR_COOKIE);
			const storeMatch = pathname.match(/^\/store\/([^/]+)$/);
			if (pathname === "/store") return htmlResponse(await storePage(url, visitor));
			if (pathname === "/store/wishlist") return htmlResponse(await wishlistPage(url, visitor));
			if (pathname === "/store/compare") return htmlResponse(await comparePage(url, visitor));
			if (storeMatch) {
				const product = await productPage(url, decodeURIComponent(storeMatch[1]!), visitor);
				return htmlResponse(product.html, product.status);
			}
			if (pathname === "/cart") return htmlResponse(await cartPage(url.origin, visitor));
			// [/bd:store]
			// [bd:subscriptions]
			if (pathname === "/subscriptions") return htmlResponse(await subscriptionsPage(url.origin, getCookie(req, VISITOR_COOKIE)));
			// [/bd:subscriptions]
			// [bd:blog]
			const blogMatch = pathname.match(/^\/blog\/([^/]+)$/);
			if (pathname === "/blog") return htmlResponse(await blogIndexPage(url));
			if (blogMatch) {
				const post = await blogPostPage(url, decodeURIComponent(blogMatch[1]!), getCookie(req, SESSION_COOKIE));
				return htmlResponse(post.html, post.status);
			}
			// [/bd:blog]
			if (pathname === "/reviews") return htmlResponse(await reviewsPage(url, getCookie(req, SESSION_COOKIE)));
			if (pathname === "/updates") return htmlResponse(await updatesPage(url.origin));
			if (pathname === "/todos") return htmlResponse(await todosPage(url.origin));
			if (pathname === "/services") return htmlResponse(await servicesPage(url.origin));
			if (svcMatch) return htmlResponse(await serviceAreaPage(url.origin, decodeURIComponent(svcMatch[1]!), decodeURIComponent(svcMatch[2]!)));
			if (pathname === "/my-account") {
				// Signed in already, with somewhere to go back to (a quiz invitation's sign-in link).
				const next = safeNext(url.searchParams.get("next"));
				if (next && (await getSession(getCookie(req, SESSION_COOKIE)))) return Response.redirect(new URL(next, url.origin), 303);
				return htmlResponse(await myAccountPage(url, getCookie(req, SESSION_COOKIE)));
			}
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

console.log(`[bd] HTMX starter listening on http://localhost:${server.port}`);

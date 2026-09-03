/**
 * Shared page shell + helpers for the server-rendered feature pages.
 * HTMX returns HTML, so a "page" here is a full document string built with
 * the `html` tagged template (auto-escaping) from ./html.
 */

import { localBusiness, renderJsonLdToHtml, website } from "@businessdash/sdk/seo";

import { ANALYTICS_PUBLIC, BD_CONFIGURED, BD_HOST, getBd } from "./bd";
import { cached } from "./cache";
import { html, raw, render, type Raw } from "./html";

export const VISITOR_COOKIE = "bd_cart_visitor";
export const SESSION_COOKIE = "bd_session";
const VISITOR_MAX_AGE = 60 * 60 * 24 * 180; // 180 days

export function getCookie(req: Request, name: string): string | null {
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

export function visitorSetCookie(token: string): string {
	return `${VISITOR_COOKIE}=${token}; HttpOnly; Path=/; SameSite=Lax; Max-Age=${VISITOR_MAX_AGE}`;
}

/** Resolve the visitor's cart token, minting + returning a Set-Cookie when new. */
export function resolveVisitor(req: Request): { token: string; setCookie?: string } {
	const existing = getCookie(req, VISITOR_COOKIE);
	if (existing) return { token: existing };
	const token = crypto.randomUUID();
	return { token, setCookie: visitorSetCookie(token) };
}

/** Format a cents integer (subscriptions / checkout totals). */
export function money(cents: number | null | undefined, currency = "USD"): string {
	if (cents == null || Number.isNaN(Number(cents))) return "";
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(cents) / 100);
}

/** Format an already-decimal amount (cart unitPrice / subtotal). */
export function dollars(amount: number | null | undefined, currency = "USD"): string {
	if (amount == null || Number.isNaN(Number(amount))) return "";
	return new Intl.NumberFormat("en-US", { style: "currency", currency }).format(Number(amount));
}

export function errBlock(err: unknown): Raw {
	const e = err instanceof Error ? err : new Error(String(err));
	const text = `${e.name} ${e.message}`;
	const unavailable = /Suspended|Lapsed|unavailable|\b503\b/i.test(text);
	const notConfigured = /not configured/i.test(text);
	return html`<div class="page__error">${
		unavailable
			? "This site is temporarily unavailable. Please check back soon."
			: notConfigured
				? "BD isn't configured on this server — set the env vars in .env.local (see .env.example)."
				: "Couldn't load this section."
	}</div>`;
}

// ── JSON-LD + banner ───────────────────────────────────────────────

async function homeBundle(): Promise<Record<string, any> | null> {
	const bd = getBd();
	if (!bd) return null;
	try {
		// biome-ignore lint: bundle shape is an untyped passthrough at 0.9.5
		return (await cached("bundle:home:en", ["bd:marketing"], () =>
			bd.marketing.getPageBundle({ pageKey: "home", locale: "en" }),
		)) as Record<string, any>;
	} catch {
		return null;
	}
}

async function siteJsonLd(origin: string): Promise<string> {
	const bundle = await homeBundle();
	if (!bundle) return "";
	try {
		const company = (bundle.company as any)?.profile ?? {};
		const info = (bundle.sections as any)?.companyInfo?.data ?? (bundle.sections as any)?.companyInfo ?? {};
		const name: string = company.name ?? info.name ?? "BD Starter Site";
		return renderJsonLdToHtml([
			localBusiness({
				siteUrl: origin,
				name,
				telephone: company.phone ?? info.phone,
				email: company.email ?? info.email,
			}),
			website({ siteUrl: origin, name }),
		]);
	} catch {
		return "";
	}
}

function pickBanner(banner: any): { text: string; link: string | null; linkText: string | null } | null {
	if (!banner || banner.enabled === false) return null;
	const list = Array.isArray(banner.messages) ? banner.messages : banner.message || banner.text ? [banner] : [];
	const now = Date.now();
	for (const m of list) {
		const from = m.displayFromUtc ? Date.parse(m.displayFromUtc) : null;
		const until = m.displayUntilUtc ? Date.parse(m.displayUntilUtc) : null;
		if (from && from > now) continue;
		if (until && until < now) continue;
		const text = m.text ?? m.message;
		if (!text) continue;
		return { text, link: m.link ?? null, linkText: m.linkText ?? m.buttonText ?? null };
	}
	return null;
}

/** The news banner as an HTML string (empty when none) — used as an HTMX
 *  fragment on the home page. */
export async function renderBanner(): Promise<string> {
	return render(await bannerHtml());
}

async function bannerHtml(): Promise<Raw> {
	const bundle = await homeBundle();
	const msg = pickBanner(bundle?.banner);
	if (!msg) return raw("");
	return html`<div class="newsbanner" role="region" aria-label="Announcement">
		<span class="newsbanner__text">${msg.text}</span>
		${msg.link ? html`<a class="newsbanner__link" href="${msg.link}">${msg.linkText || "Learn more"}</a>` : ""}
		<button class="newsbanner__close" type="button" aria-label="Dismiss" onclick="this.closest('.newsbanner').remove()">×</button>
	</div>`;
}

function navBar(): Raw {
	return html`<header class="docnav">
		<a class="docnav__brand" href="/">Your&nbsp;Business</a>
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
			<a href="/api/bd-auth/sign-in">Sign in</a>
			<a href="/api/bd-auth/sign-up" class="docnav__cta">Sign up</a>
		</span>
	</header>`;
}

/**
 * Dismissable "not connected to BD yet" bar (fixed bottom). Rendered only
 * when the site isn't wired up (no resolved site id); dismiss persists to the
 * localStorage key "bd-sdk-setup-banner-dismissed". Injected into the static
 * home shell (server.ts) and every server-rendered feature page (`page()`).
 * Returns "" (nothing shipped) once BD is configured.
 */
export function setupBannerHtml(): string {
	if (BD_CONFIGURED) return "";
	const wizard = `${BD_HOST}/login?returnTo=/dashboard/settings/web-content`;
	return `<div id="bd-setup-banner" hidden style="position:fixed;inset-inline:0;bottom:0;z-index:9999;display:flex;flex-wrap:wrap;align-items:center;gap:0.75rem;padding:0.75rem 1rem;background:#111827;color:#fff;border-top:1px solid var(--accent,#047857);font-size:0.875rem;">
	<span style="flex:1 1 260px;min-width:0;"><strong style="color:#6ee7b7;">Not connected to BD yet.</strong> Add your <code>.env.local</code> to render live content — grab every variable from the guided wizard.</span>
	<a href="${wizard}" target="_blank" rel="noreferrer" style="flex-shrink:0;border-radius:0.5rem;border:1px solid var(--accent,#047857);background:rgba(4,120,87,0.18);padding:0.4rem 0.8rem;color:#a7f3d0;font-weight:600;text-decoration:none;">Open setup wizard ↗</a>
	<button id="bd-setup-banner-dismiss" type="button" aria-label="Dismiss" style="flex-shrink:0;border:none;background:transparent;color:rgba(255,255,255,0.6);cursor:pointer;font-size:1.1rem;line-height:1;padding:0.25rem;">✕</button>
</div>
<script>(function(){var K="bd-sdk-setup-banner-dismissed",e=document.getElementById("bd-setup-banner");if(!e)return;try{if(localStorage.getItem(K)==="1"){e.remove();return;}}catch(x){}e.hidden=false;var b=document.getElementById("bd-setup-banner-dismiss");if(b)b.addEventListener("click",function(){try{localStorage.setItem(K,"1");}catch(x){}e.remove();});})();</script>`;
}

function analyticsScript(): Raw {
	if (!ANALYTICS_PUBLIC.siteId || !ANALYTICS_PUBLIC.baseUrl || !ANALYTICS_PUBLIC.apiKey) return raw("");
	const config = JSON.stringify({
		siteId: ANALYTICS_PUBLIC.siteId,
		baseUrl: ANALYTICS_PUBLIC.baseUrl,
		apiKey: ANALYTICS_PUBLIC.apiKey,
	});
	return raw(`<script>window.__BD_ANALYTICS__=${config};</script>`);
}

/** Render a full feature-page document. `body` is trusted HTML (a Raw or a
 *  string produced by this app's own renderers). */
export async function page(opts: {
	origin: string;
	title: string;
	description?: string;
	body: Raw | string;
}): Promise<string> {
	const jsonLd = await siteJsonLd(opts.origin);
	const banner = await bannerHtml();
	const bodyNode = typeof opts.body === "string" ? raw(opts.body) : opts.body;
	const doc = html`<!doctype html>
<html lang="en">
<head>
	<meta charset="utf-8" />
	<meta name="viewport" content="width=device-width, initial-scale=1" />
	<title>${opts.title}</title>
	${opts.description ? html`<meta name="description" content="${opts.description}" />` : ""}
	<link rel="stylesheet" href="/styles.css" />
	<!-- SDK forms stylesheet (file-upload box, multi-step header, choice chips). -->
	<link rel="stylesheet" href="/bd-forms.css" />
	${raw(jsonLd)}
</head>
<body>
	${banner}
	${navBar()}
	<main class="page">${bodyNode}</main>
	<footer class="app-footer"><div>© Your Business — built on @businessdash/sdk</div></footer>
	${analyticsScript()}
	${raw(setupBannerHtml())}
</body>
</html>`;
	return render(doc);
}

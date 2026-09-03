/**
 * Server-side BD layer. EVERYTHING that holds the API key lives here
 * and ONLY here. This module is imported exclusively by the Express SSR
 * server (`src/server.ts`) — never by browser-shipped Angular code. The
 * browser talks to the small JSON endpoints in `src/server.ts`, which in
 * turn call the helpers below.
 *
 * Why server-only? The BD package API key is an org-bound secret. If it
 * shipped in the browser bundle, anyone could read your CRM, mutate carts
 * for other visitors, etc. Keeping it here means the key never leaves Node.
 *
 * Env (read from process.env — Node only):
 *   BD_API_KEY                 the per-site package key (server secret)
 *   BD_SITE_ID                 your site uuid
 *   BD_PACKAGE_API_BASE_URL    your BD origin (default https://www.biab.app)
 *   BD_REVALIDATION_SECRET     HMAC secret for the revalidate webhook
 *   BD_AUTH_CALLBACK_URL       public URL of /api/bd-auth/callback
 *
 * Everything no-ops gracefully when env is unset: `getBd()` returns null,
 * and the JSON endpoints answer with empty/placeholder shapes so the site
 * still renders with the demo content the components ship.
 */

import {
	createBdClient,
	createBdApiClient,
	getTenantSession,
	BdPaymentLapsedError,
	BdServiceSuspendedError,
	type BdClient,
	type GetMarketingPageBundleResponse,
} from "@businessdash/sdk";

// ── Env ────────────────────────────────────────────────────────────

export type BdEnv = {
	apiKey: string;
	siteId: string;
	baseUrl: string;
	revalidationSecret?: string;
	authCallbackUrl?: string;
};

/** The auth-session cookie the SDK's auth handler sets (httpOnly). */
export const SESSION_COOKIE = "bd_session";
/** The anonymous-shopper cart cookie THIS server mints (httpOnly). */
export const VISITOR_COOKIE = "bd_cart_visitor";
/** 180 days, matching DGP's visitor-token lifetime. */
export const VISITOR_MAX_AGE_SECONDS = 60 * 60 * 24 * 180;

function normaliseBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

let envCache: BdEnv | null | undefined;

/** Resolve env once. Returns null when the required keys are missing. */
export function getBdEnv(): BdEnv | null {
	if (envCache !== undefined) return envCache;
	const apiKey = process.env["BD_API_KEY"];
	// Server reads plain env vars; the browser-safe values (pk/site id/base url)
	// live in src/environments/environment.ts, Angular's own build-time config.
	const siteId = process.env["BD_SITE_ID"];
	const rawBase =
		process.env["BD_PACKAGE_API_BASE_URL"] ?? "https://www.biab.app";
	if (!apiKey || !siteId) {
		envCache = null;
		return null;
	}
	envCache = {
		apiKey,
		siteId,
		baseUrl: normaliseBaseUrl(rawBase),
		revalidationSecret: process.env["BD_REVALIDATION_SECRET"] || undefined,
		authCallbackUrl: process.env["BD_AUTH_CALLBACK_URL"] || undefined,
	};
	return envCache;
}

let clientCache: BdClient | null | undefined;

/** The high-level SDK client, or null when env is unset. */
export function getBd(): BdClient | null {
	if (clientCache !== undefined) return clientCache;
	const env = getBdEnv();
	if (!env) {
		clientCache = null;
		return null;
	}
	clientCache = createBdClient({
		apiKey: env.apiKey,
		siteId: env.siteId,
		baseUrl: env.baseUrl,
	});
	return clientCache;
}

/**
 * Custom-database reader for the Todos demo — the SDK's documented READ path
 * for custom collections is `createBdApiClient(...).site(id).dataModel`
 * (`listRecords({ object })`). Needs `metadata:read_records` on the key;
 * null when env is unset.
 */
export function getBdDataModel() {
	const env = getBdEnv();
	if (!env) return null;
	return createBdApiClient({ apiKey: env.apiKey, baseUrl: env.baseUrl })
		.site(env.siteId)
		.dataModel;
}

/**
 * BD app ORIGIN (e.g. https://www.biab.app) for the AI surfaces
 * (`/llms.txt`, `/api/mcp`, `/.well-known/mcp.json`) — unlike the SDK
 * transport those take the host root, not the package API base.
 */
export function getBdHostBase(): string | null {
	const env = getBdEnv();
	if (!env) return null;
	return env.baseUrl.replace(/\/api\/package\/v1$/, "");
}

// ── Tiny in-memory, tag-keyed TTL cache ────────────────────────────
//
// Angular SSR has no framework data cache (unlike Next's fetch cache),
// so we add a small one here. Every cached read is stored under one or
// more BD cache tags (e.g. "bd:marketing", "bd:reviews"). The
// revalidate webhook's onTagsRevalidated() drops every entry whose tag
// set intersects the revalidated tags — so the webhook is real, not
// decorative. Entries also expire after `ttlMs` as a backstop.

type CacheEntry = { value: unknown; expires: number; tags: string[] };
const cache = new Map<string, CacheEntry>();
const DEFAULT_TTL_MS = 60_000;

/** Read-through cache. `tags` lets the webhook invalidate the entry. */
export async function cached<T>(
	key: string,
	tags: string[],
	loader: () => Promise<T>,
	ttlMs = DEFAULT_TTL_MS,
): Promise<T> {
	const hit = cache.get(key);
	if (hit && hit.expires > Date.now()) return hit.value as T;
	const value = await loader();
	cache.set(key, { value, expires: Date.now() + ttlMs, tags });
	return value;
}

/** Drop every cache entry tagged with one of `tags`. Called by the webhook. */
export function invalidateTags(tags: string[]): number {
	if (tags.length === 0) return 0;
	const wanted = new Set(tags);
	let dropped = 0;
	for (const [key, entry] of cache) {
		if (entry.tags.some((t) => wanted.has(t))) {
			cache.delete(key);
			dropped++;
		}
	}
	return dropped;
}

/** Wipe the whole cache (used by tests / a "revalidate everything" event). */
export function clearCache(): void {
	cache.clear();
}

// ── Suspension handling ────────────────────────────────────────────
//
// When the org's billing lapses or the platform suspends the service,
// the SDK throws BdPaymentLapsedError / BdServiceSuspendedError.
// `runGuarded` turns those into a typed result the endpoints map to a
// minimal "unavailable" state (503) instead of a hard crash.

export type GuardResult<T> =
	| { ok: true; data: T }
	| { ok: false; suspended: true; reason: string }
	| { ok: false; suspended: false; reason: string };

export async function runGuarded<T>(fn: () => Promise<T>): Promise<GuardResult<T>> {
	try {
		return { ok: true, data: await fn() };
	} catch (err) {
		if (
			err instanceof BdPaymentLapsedError ||
			err instanceof BdServiceSuspendedError
		) {
			return {
				ok: false,
				suspended: true,
				reason: err.message || "This site is temporarily unavailable.",
			};
		}
		return {
			ok: false,
			suspended: false,
			reason: err instanceof Error ? err.message : "Request failed.",
		};
	}
}

// ── Marketing bundle (home page content + banner + updates + reviews) ─

export async function getPageBundle(
	pageKey = "home",
	locale = "en",
): Promise<GetMarketingPageBundleResponse | null> {
	const bd = getBd();
	if (!bd) return null;
	const env = getBdEnv()!;
	return cached(
		`bundle:${env.siteId}:${pageKey}:${locale}`,
		["bd:marketing", `bd:marketing:${pageKey}`, "bd:banner", "bd:updates", "bd:reviews"],
		() => bd.marketing.getPageBundle({ pageKey, locale }),
	);
}

/** Pull `data` off a `{ ok, data }` section entry; null when missing/errored. */
export function sectionData<T = Record<string, unknown>>(
	bundle: GetMarketingPageBundleResponse | null,
	key: string,
): T | null {
	const entry = bundle?.sections?.[key] as { ok?: boolean; data?: unknown } | undefined;
	if (entry && entry.ok && entry.data && typeof entry.data === "object") {
		return entry.data as T;
	}
	return null;
}

// ── Customer-portal session ────────────────────────────────────────

export type ResolvedSession = {
	/** Raw cookie value — THIS is the token passed to `.withSession(...)`. */
	token: string;
	organizationId: string;
	user: { email: string | null; firstName: string | null; lastName: string | null };
	role: string | null;
};

export async function readSession(
	cookieValue: string | null | undefined,
): Promise<ResolvedSession | null> {
	const env = getBdEnv();
	if (!env || !cookieValue) return null;
	const me = await getTenantSession({
		cookieValue,
		baseUrl: env.baseUrl,
		apiKey: env.apiKey,
	});
	if (!me) return null;
	return {
		token: cookieValue, // the cookie value IS the tenantAuth session token
		organizationId: me.organizationId,
		user: {
			email: me.user.email ?? null,
			firstName: me.user.firstName ?? null,
			lastName: me.user.lastName ?? null,
		},
		role: me.role ?? null,
	};
}

/** A customer-portal client bound to the signed-in customer's org + session. */
export function portalForSession(organizationId: string, sessionToken: string) {
	const env = getBdEnv();
	if (!env) return null;
	return createBdApiClient({ baseUrl: env.baseUrl, apiKey: env.apiKey })
		.customerPortal(organizationId)
		.withSession(sessionToken);
}

export { BdPaymentLapsedError, BdServiceSuspendedError };

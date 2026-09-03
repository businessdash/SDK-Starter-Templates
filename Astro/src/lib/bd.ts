import { createBdClient, type BdClient } from "@businessdash/sdk";

/**
 * Server-side BD client. Astro pages run on the server (we set
 * `output: "server"` in `astro.config.mjs`), so each render reaches
 * straight into the SDK — no separate proxy process needed.
 *
 * Astro pre-fetches env via `import.meta.env`; we also fall back to
 * `process.env` for non-Vite contexts (the API endpoints under
 * `src/pages/api/`).
 *
 * Returns `null` when env isn't configured so callers can render
 * local fallbacks instead of crashing the page.
 */

const apiKey =
	import.meta.env.BD_API_KEY ?? process.env.BD_API_KEY;
// SITE_ID + base URL aren't secret; the canonical names are the browser-safe
// PUBLIC_ twins. Prefer those, then fall back to the legacy plain server
// names so already-configured setups keep working. (Astro exposes non-PUBLIC_
// vars server-side; only `PUBLIC_`-prefixed ones reach the client bundle.)
const siteId =
	import.meta.env.PUBLIC_BD_SITE_ID ??
	import.meta.env.BD_SITE_ID ??
	process.env.PUBLIC_BD_SITE_ID ??
	process.env.BD_SITE_ID;
const rawBaseUrl =
	import.meta.env.PUBLIC_BD_PACKAGE_API_BASE_URL ??
	import.meta.env.BD_PACKAGE_API_BASE_URL ??
	process.env.PUBLIC_BD_PACKAGE_API_BASE_URL ??
	process.env.BD_PACKAGE_API_BASE_URL;

export function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

/**
 * Resolved server-side env, shared by the auth handler, customer portal,
 * sitemap/robots proxies, and anything that needs the raw key/base URL
 * (not just the high-level `bd` client). Returns `null` until configured.
 */
export function getBdEnv(): {
	apiKey: string;
	siteId: string;
	baseUrl: string;
} | null {
	if (!apiKey || !siteId || !rawBaseUrl) return null;
	return {
		apiKey: apiKey as string,
		siteId: siteId as string,
		baseUrl: normalizeBaseUrl(rawBaseUrl as string),
	};
}

let cached: BdClient | null | undefined;

export function getBd(): BdClient | null {
	if (cached !== undefined) return cached;
	if (!apiKey || !siteId || !rawBaseUrl) {
		cached = null;
		return cached;
	}
	cached = createBdClient({
		apiKey: apiKey as string,
		siteId: siteId as string,
		baseUrl: normalizeBaseUrl(rawBaseUrl as string),
	});
	return cached;
}

export const bd = getBd();

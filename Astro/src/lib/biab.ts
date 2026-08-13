import { createBiabClient, type BiabClient } from "@businessdash/sdk";

/**
 * Server-side BIAB client. Astro pages run on the server (we set
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
	import.meta.env.BIAB_API_KEY ?? process.env.BIAB_API_KEY;
// SITE_ID + base URL aren't secret; the canonical names are the browser-safe
// PUBLIC_ twins. Prefer those, then fall back to the legacy plain server
// names so already-configured setups keep working. (Astro exposes non-PUBLIC_
// vars server-side; only `PUBLIC_`-prefixed ones reach the client bundle.)
const siteId =
	import.meta.env.PUBLIC_BIAB_SITE_ID ??
	import.meta.env.BIAB_SITE_ID ??
	process.env.PUBLIC_BIAB_SITE_ID ??
	process.env.BIAB_SITE_ID;
const rawBaseUrl =
	import.meta.env.PUBLIC_BIAB_PACKAGE_API_BASE_URL ??
	import.meta.env.BIAB_PACKAGE_API_BASE_URL ??
	process.env.PUBLIC_BIAB_PACKAGE_API_BASE_URL ??
	process.env.BIAB_PACKAGE_API_BASE_URL;

export function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

/**
 * Resolved server-side env, shared by the auth handler, customer portal,
 * sitemap/robots proxies, and anything that needs the raw key/base URL
 * (not just the high-level `biab` client). Returns `null` until configured.
 */
export function getBiabEnv(): {
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

let cached: BiabClient | null | undefined;

export function getBiab(): BiabClient | null {
	if (cached !== undefined) return cached;
	if (!apiKey || !siteId || !rawBaseUrl) {
		cached = null;
		return cached;
	}
	cached = createBiabClient({
		apiKey: apiKey as string,
		siteId: siteId as string,
		baseUrl: normalizeBaseUrl(rawBaseUrl as string),
	});
	return cached;
}

export const biab = getBiab();

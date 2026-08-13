/**
 * Server-only BIAB client. Qwik bundles this only into server
 * contexts — `routeLoader$`, `server$`, and `onPost` handlers —
 * because we only import it from those `$`-boundary call sites.
 * The bearer key never enters the client bundle.
 *
 * Returns `null` when env isn't configured so callers can render
 * local fallbacks without crashing the page.
 */

import { createBiabClient, type BiabClient } from "@businessdash/sdk";

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

let cached: BiabClient | null | undefined;

export function getBiab(): BiabClient | null {
	if (cached !== undefined) return cached;
	const apiKey = process.env.BIAB_API_KEY;
	// SITE_ID + base URL aren't secret; the canonical names are the
	// PUBLIC_ twins (the browser needs them too). Fall back to the legacy
	// plain names so already-configured .env files keep working.
	const siteId =
		process.env.PUBLIC_BIAB_SITE_ID ?? process.env.BIAB_SITE_ID;
	const baseUrl =
		process.env.PUBLIC_BIAB_PACKAGE_API_BASE_URL ??
		process.env.BIAB_PACKAGE_API_BASE_URL;
	if (!apiKey || !siteId || !baseUrl) {
		cached = null;
		return cached;
	}
	cached = createBiabClient({
		apiKey,
		siteId,
		baseUrl: normalizeBaseUrl(baseUrl),
	});
	return cached;
}

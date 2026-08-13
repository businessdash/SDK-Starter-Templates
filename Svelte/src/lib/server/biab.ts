import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

import { createBiabClient, type BiabClient } from "@businessdash/sdk";

/**
 * Server-only BIAB client. Lives under `$lib/server/`, which means
 * SvelteKit's bundler will throw a build error if any client-side
 * code imports it — keeping the bearer key safely on the server.
 *
 * The `+page.server.ts` load function calls this during render; the
 * `+page.svelte` component receives the data via props and never
 * imports the SDK itself.
 */
function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

let cached: BiabClient | null | undefined;

export function getBiab(): BiabClient | null {
	if (cached !== undefined) return cached;
	const apiKey = env.BIAB_API_KEY;
	// SITE_ID + base URL aren't secret; the canonical vars are the browser-safe
	// PUBLIC_ twins (SvelteKit exposes those to the client too). Fall back to the
	// legacy server-only names so already-deployed apps keep working.
	const siteId = publicEnv.PUBLIC_BIAB_SITE_ID ?? env.BIAB_SITE_ID;
	const baseUrl =
		publicEnv.PUBLIC_BIAB_PACKAGE_API_BASE_URL ?? env.BIAB_PACKAGE_API_BASE_URL;
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

export const biab = getBiab();

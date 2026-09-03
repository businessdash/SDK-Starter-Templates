import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

import { createBdClient, type BdClient } from "@businessdash/sdk";

/**
 * Server-only BD client. Lives under `$lib/server/`, which means
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

let cached: BdClient | null | undefined;

export function getBd(): BdClient | null {
	if (cached !== undefined) return cached;
	const apiKey = env.BD_API_KEY;
	// SITE_ID + base URL aren't secret; the canonical vars are the browser-safe
	// PUBLIC_ twins (SvelteKit exposes those to the client too). Fall back to the
	// legacy server-only names so already-deployed apps keep working.
	const siteId = publicEnv.PUBLIC_BD_SITE_ID ?? env.BD_SITE_ID;
	const baseUrl =
		publicEnv.PUBLIC_BD_PACKAGE_API_BASE_URL ?? env.BD_PACKAGE_API_BASE_URL;
	if (!apiKey || !siteId || !baseUrl) {
		cached = null;
		return cached;
	}
	cached = createBdClient({
		apiKey,
		siteId,
		baseUrl: normalizeBaseUrl(baseUrl),
	});
	return cached;
}

export const bd = getBd();

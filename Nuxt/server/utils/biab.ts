import { createBiabClient, type BiabClient } from "@businessdash/sdk";

/**
 * Server-only BIAB client. Lives under `server/utils/`, which Nuxt
 * auto-imports into every Nitro route + only ever bundles into the
 * server output. The bearer key never enters the client bundle.
 *
 * Returns `null` when env isn't configured so callers can return
 * sensible defaults instead of crashing the page.
 */

function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

let cached: BiabClient | null | undefined;

export function getBiab(): BiabClient | null {
	if (cached !== undefined) return cached;
	const config = useRuntimeConfig();
	const apiKey = config.biabApiKey;
	const siteId = config.biabSiteId;
	const baseUrl = config.biabPackageApiBaseUrl;
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

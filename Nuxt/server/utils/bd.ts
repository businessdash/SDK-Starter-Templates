import { createBdClient, type BdClient } from "@businessdash/sdk";

/**
 * Server-only BD client. Lives under `server/utils/`, which Nuxt
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

let cached: BdClient | null | undefined;

export function getBd(): BdClient | null {
	if (cached !== undefined) return cached;
	const config = useRuntimeConfig();
	const apiKey = config.bdApiKey;
	const siteId = config.bdSiteId;
	const baseUrl = config.bdPackageApiBaseUrl;
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

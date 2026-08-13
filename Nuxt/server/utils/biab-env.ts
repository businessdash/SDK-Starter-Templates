/**
 * Shared BIAB env resolution for the surfaces that need the raw
 * base URL + API key rather than the high-level `getBiab()` client:
 * the auth handler, the customer portal, and the sitemap/robots
 * proxies.
 *
 * `getBiab()` (server/utils/biab.ts) is the right entry point for
 * everything that reads marketing/storefront/cart data. These helpers
 * exist only because a few SDK surfaces (`createAuthHandler`,
 * `createBiabDevClient(...).customerPortal(...)`, the SEO proxies)
 * take a `baseUrl` + `apiKey` directly.
 *
 * Everything is server-only — `runtimeConfig` (non-`public`) is never
 * bundled into the client.
 */

export function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

export type BiabBaseConfig = {
	apiKey: string;
	siteId: string;
	/** Already normalized to `…/api/package/v1`. */
	baseUrl: string;
	/** Raw (un-normalized) host, e.g. `https://www.biab.app` — for the SEO proxies. */
	rawBaseUrl: string;
};

/**
 * The minimal config the raw-URL surfaces need. Returns `null` when
 * BIAB isn't configured so callers can degrade to a no-op state.
 */
export function getBiabBaseConfig(): BiabBaseConfig | null {
	const config = useRuntimeConfig();
	const apiKey = config.biabApiKey as string;
	const siteId = config.biabSiteId as string;
	const rawBaseUrl = config.biabPackageApiBaseUrl as string;
	if (!apiKey || !siteId || !rawBaseUrl) return null;
	return {
		apiKey,
		siteId,
		baseUrl: normalizeBaseUrl(rawBaseUrl),
		rawBaseUrl: rawBaseUrl.trim().replace(/\/+$/, ""),
	};
}

/** The fully-qualified auth callback URL, or `null` when unset. */
export function getAuthCallbackUrl(): string | null {
	const url = useRuntimeConfig().biabAuthCallbackUrl as string;
	return url ? url : null;
}

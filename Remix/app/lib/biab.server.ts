import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
	createBiabClient,
	type BiabClient,
} from "@businessdash/sdk";

/**
 * Server-side BIAB client. Remix `loader` + `action` functions run on
 * the server, so the SDK + the bearer key live here. The browser
 * never sees them.
 *
 * Returns `null` when env isn't configured so loaders can render
 * local fallbacks instead of throwing.
 */

const apiKey = process.env["BIAB_API_KEY"];
// SITE_ID + base URL aren't secret; the canonical vars are the browser-safe
// VITE_ twins (the client bundle needs them too, so one value serves both).
// Fall back to the legacy server-only names so already-deployed apps keep
// working.
const siteId = process.env["VITE_BIAB_SITE_ID"] ?? process.env["BIAB_SITE_ID"];
const rawBaseUrl =
	process.env["VITE_BIAB_PACKAGE_API_BASE_URL"] ??
	process.env["BIAB_PACKAGE_API_BASE_URL"];

export function normaliseBaseUrl(input: string): string {
	const next = input.trim().replace(/\/$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

let cached: BiabClient | null | undefined;

export function getBiab(): BiabClient | null {
	if (cached !== undefined) return cached;
	if (!apiKey || !siteId || !rawBaseUrl) {
		cached = null;
		return cached;
	}
	cached = createBiabClient({
		apiKey,
		siteId,
		baseUrl: normaliseBaseUrl(rawBaseUrl),
	});
	return cached;
}

/** The configured BIAB site id (or null when unconfigured). */
export function getSiteId(): string | null {
	return siteId ?? null;
}

/**
 * Lower-level env passthrough for the surfaces that build their own
 * client (auth handler, customer portal) rather than the high-level
 * `createBiabClient`. Returns `null` when the bearer key or base URL
 * is missing so callers can no-op gracefully.
 */
export function getServerConfig(): {
	apiKey: string;
	siteId: string | undefined;
	baseUrl: string;
} | null {
	if (!apiKey || !rawBaseUrl) return null;
	return { apiKey, siteId, baseUrl: normaliseBaseUrl(rawBaseUrl) };
}

/**
 * Whether the caught error is a BIAB billing/suspension rejection. Both
 * `BiabPaymentLapsedError` and `BiabServiceSuspendedError` extend
 * `BiabAccessRejectedError`; the suspended case is the only one that
 * should hard-block a public page (lapsed payments still serve).
 */
export function isServiceSuspended(err: unknown): boolean {
	return err instanceof BiabServiceSuspendedError;
}

export function isPaymentLapsed(err: unknown): boolean {
	return err instanceof BiabPaymentLapsedError;
}

/** Either suspension-family error — use to gate a "site unavailable" state. */
export function isSuspensionError(err: unknown): boolean {
	return isServiceSuspended(err) || isPaymentLapsed(err);
}

/**
 * Loader-side env passthrough so the client can boot BIAB analytics
 * without baking the public key into the build. Returns only the
 * public-safe values — never the bearer key (the bearer key never
 * leaves this server module).
 *
 * The analytics-core init treats `apiKey` as the public-read key,
 * which is the same as the SDK bearer key for BIAB. If you want a
 * separate analytics-only key, mint one in BIAB dashboard → API
 * keys and set it as `BIAB_PUBLIC_KEY` here.
 */
export function getAnalyticsConfig(): {
	siteId: string;
	baseUrl: string;
	apiKey: string;
} | null {
	if (!siteId || !rawBaseUrl) return null;
	const publicKey = process.env["BIAB_PUBLIC_KEY"] ?? apiKey;
	if (!publicKey) return null;
	return {
		siteId,
		baseUrl: normaliseBaseUrl(rawBaseUrl),
		apiKey: publicKey,
	};
}

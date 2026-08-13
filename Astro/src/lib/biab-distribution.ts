/**
 * Shared config for the AEO + MCP proxy routes — `/llms.txt`, `/api/mcp`,
 * `/.well-known/mcp.json`, and `/ai/product-feed`.
 *
 * The platform serves those artifacts from its bare ORIGIN
 * (`…/api/public/ai-feed/<siteId>/…` and `…/api/public/mcp/<siteId>`), not
 * from the package API — so this derives the origin from the same base-URL
 * env the rest of the template already uses. Returns `null` when unconfigured
 * so each route can fall back gracefully.
 */

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

export function getDistributionConfig(): {
	siteId: string;
	baseUrl: string;
} | null {
	if (!siteId || !rawBaseUrl) return null;
	try {
		return {
			siteId: siteId as string,
			baseUrl: new URL(rawBaseUrl as string).origin,
		};
	} catch {
		return null;
	}
}

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
export function getDistributionConfig(): {
	siteId: string;
	baseUrl: string;
} | null {
	const siteId = process.env.PUBLIC_BD_SITE_ID ?? process.env.BD_SITE_ID;
	const raw =
		process.env.PUBLIC_BD_PACKAGE_API_BASE_URL ??
		process.env.BD_PACKAGE_API_BASE_URL;
	if (!siteId || !raw) return null;
	try {
		return { siteId, baseUrl: new URL(raw).origin };
	} catch {
		return null;
	}
}

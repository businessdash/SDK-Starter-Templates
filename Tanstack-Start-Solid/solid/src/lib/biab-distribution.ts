/**
 * Shared config for the AEO + MCP proxy routes — `/llms.txt`, `/api/mcp`,
 * `/.well-known/mcp.json`, and `/ai/product-feed`.
 *
 * The platform serves those artifacts from its bare ORIGIN
 * (`…/api/public/ai-feed/<siteId>/…` and `…/api/public/mcp/<siteId>`), not
 * from the package API — so this derives the origin from the same base-URL
 * env the rest of the template already uses. Returns `null` when unconfigured
 * so each route can fall back gracefully. Server-only — import it from route
 * server handlers only, like `lib/biab.ts`.
 */
export function getDistributionConfig(): {
	siteId: string;
	baseUrl: string;
} | null {
	const siteId = process.env.VITE_BIAB_SITE_ID ?? process.env.BIAB_SITE_ID;
	const raw =
		process.env.VITE_BIAB_PACKAGE_API_BASE_URL ??
		process.env.BIAB_PACKAGE_API_BASE_URL;
	if (!siteId || !raw) return null;
	try {
		return { siteId, baseUrl: new URL(raw).origin };
	} catch {
		return null;
	}
}

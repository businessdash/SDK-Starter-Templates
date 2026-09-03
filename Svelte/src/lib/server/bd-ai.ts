import { env } from "$env/dynamic/private";
import { env as publicEnv } from "$env/dynamic/public";

/**
 * Shared config for the AI surfaces (`/llms.txt`, `/api/mcp`,
 * `/.well-known/mcp.json`).
 *
 * Unlike the SDK transport (which wants `…/api/package/v1`), the
 * distribution + MCP handlers take the BD app ORIGIN (e.g.
 * `https://www.biab.app`) — the public ai-feed and per-site MCP endpoints
 * live at the host root. No API key involved: these proxy PUBLIC platform
 * artifacts, and the platform enforces the org's AI Distribution
 * entitlement + MCP opt-in upstream.
 */
export function aiSurfaceConfig(): { siteId: string; baseUrl: string } | null {
	const siteId = publicEnv.PUBLIC_BD_SITE_ID ?? env.BD_SITE_ID;
	const rawBaseUrl =
		publicEnv.PUBLIC_BD_PACKAGE_API_BASE_URL ?? env.BD_PACKAGE_API_BASE_URL;
	if (!siteId || !rawBaseUrl) return null;
	return { siteId, baseUrl: rawBaseUrl.trim().replace(/\/+$/, "") };
}

import type { APIRoute } from "astro";

import { mcpManifestHandler } from "@businessdash/sdk/mcp";

import { getDistributionConfig } from "../../lib/bd-distribution";

export const prerender = false;

/**
 * `/.well-known/mcp.json` — the MCP discovery manifest, with the endpoint URL
 * rewritten to THIS domain (the requesting origin), so assistants that
 * auto-discover connectors land on the `/api/mcp` proxy next door.
 * (Astro routes `.well-known` in `src/pages/` by explicit allowance.)
 */

const config = getDistributionConfig();
const handler = config ? mcpManifestHandler(config) : null;

export const GET: APIRoute = async ({ request }) => {
	if (!handler) return Response.json({ error: "not_configured" }, { status: 404 });
	return handler(request);
};

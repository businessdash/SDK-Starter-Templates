import { mcpManifestHandler } from "@businessdash/sdk/mcp";

import { getDistributionConfig } from "@/server/lib/biab-distribution";

/**
 * `/.well-known/mcp.json` — the MCP discovery manifest, with the endpoint URL
 * rewritten to THIS domain (the requesting origin), so assistants that
 * auto-discover connectors land on the `/api/mcp` proxy next door.
 */

const config = getDistributionConfig();
const handler = config ? mcpManifestHandler(config) : null;

export async function GET(request: Request) {
	if (!handler) return Response.json({ error: "not_configured" }, { status: 404 });
	return handler(request);
}

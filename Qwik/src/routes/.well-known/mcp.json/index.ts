import type { RequestHandler } from "@builder.io/qwik-city";

import { mcpManifestHandler } from "@businessdash/sdk/mcp";

import { getDistributionConfig } from "../../../lib/bd-distribution";

/**
 * `/.well-known/mcp.json` — the MCP discovery manifest, with the endpoint URL
 * rewritten to THIS domain (the requesting origin), so assistants that
 * auto-discover connectors land on the `/api/mcp` proxy next door.
 */
export const onGet: RequestHandler = async ({ request, send }) => {
	const config = getDistributionConfig();
	if (!config) {
		send(Response.json({ error: "not_configured" }, { status: 404 }));
		return;
	}
	send(await mcpManifestHandler(config)(request));
};

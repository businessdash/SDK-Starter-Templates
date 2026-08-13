import { mcpManifestHandler } from "@businessdash/sdk/mcp";

/**
 * GET /.well-known/mcp.json
 *
 * MCP discovery manifest, with the endpoint URL rewritten to THIS domain (the
 * requesting origin) — assistants that support discovery can find the
 * connector at /api/mcp without being handed a URL.
 */

let handler: ReturnType<typeof mcpManifestHandler> | null | undefined;

function getHandler() {
	if (handler !== undefined) return handler;
	const cfg = getBiabBaseConfig();
	if (!cfg) {
		handler = null;
		return handler;
	}
	handler = mcpManifestHandler({ siteId: cfg.siteId, baseUrl: cfg.rawBaseUrl });
	return handler;
}

export default defineEventHandler(async (event) => {
	const manifest = getHandler();
	if (!manifest) {
		setResponseStatus(event, 503);
		return { error: "MCP is not configured (set the BIAB env vars)." };
	}
	return sendWebResponse(event, await manifest(toWebRequest(event)));
});

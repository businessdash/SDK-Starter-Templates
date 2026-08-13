import { getMcpHandlers } from "./mcp.post";

/**
 * GET /api/mcp — the MCP spec's 405 (the connector is POST-only JSON-RPC).
 * Kept as its own file so Nuxt's one-file-per-method routing stays intact.
 */
export default defineEventHandler(async (event) => {
	const mcp = getMcpHandlers();
	if (!mcp) {
		setResponseStatus(event, 503);
		return { error: "MCP is not configured (set the BIAB env vars)." };
	}
	return sendWebResponse(event, await mcp.GET());
});

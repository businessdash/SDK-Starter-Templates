import { mcpHandler } from "@businessdash/sdk/mcp";

/**
 * POST /api/mcp
 *
 * The site's MCP connector, served from THIS domain. The SDK handler proxies
 * JSON-RPC verbatim to BD's public per-site connector, so the URL an org
 * hands to Claude / ChatGPT / Gemini is their own site. Thin by design: the
 * platform still enforces the org's MCP opt-in and per-tool write gates — a
 * proxy can't widen anything. An unreachable upstream answers with a proper
 * JSON-RPC error and a 502.
 *
 * `GET /api/mcp` (see mcp.get.ts) mirrors the spec's 405.
 */

let handlers: ReturnType<typeof mcpHandler> | null | undefined;

export function getMcpHandlers() {
	if (handlers !== undefined) return handlers;
	const cfg = getBdBaseConfig();
	if (!cfg) {
		handlers = null;
		return handlers;
	}
	// Platform ORIGIN (e.g. https://www.biab.app), not the package API base.
	handlers = mcpHandler({ siteId: cfg.siteId, baseUrl: cfg.rawBaseUrl });
	return handlers;
}

export default defineEventHandler(async (event) => {
	const mcp = getMcpHandlers();
	if (!mcp) {
		setResponseStatus(event, 503);
		return { error: "MCP is not configured (set the BD env vars)." };
	}
	return sendWebResponse(event, await mcp.POST(toWebRequest(event)));
});

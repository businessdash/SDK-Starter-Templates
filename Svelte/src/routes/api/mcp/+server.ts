import { mcpHandler } from "@businessdash/sdk/mcp";

import { aiSurfaceConfig } from "$lib/server/bd-ai";

import type { RequestHandler } from "./$types";

/**
 * /api/mcp — the site's MCP connector, served from THIS domain.
 *
 * The SDK handler proxies JSON-RPC verbatim to BD's public per-site
 * connector, so the URL an org hands to Claude / ChatGPT / Gemini is their
 * own site. Thin by design: the platform still enforces the org's MCP
 * opt-in and per-tool write gates — a proxy can't widen anything. An
 * unreachable upstream answers with a proper JSON-RPC error and a 502;
 * GET mirrors the spec's 405 (the connector is POST-only JSON-RPC).
 */

let handlers: ReturnType<typeof mcpHandler> | null | undefined;

function getHandlers() {
	if (handlers !== undefined) return handlers;
	const cfg = aiSurfaceConfig();
	handlers = cfg ? mcpHandler(cfg) : null;
	return handlers;
}

const NOT_CONFIGURED = () =>
	Response.json(
		{ error: "MCP is not configured (set the BD env vars)." },
		{ status: 503 },
	);

export const POST: RequestHandler = async ({ request }) => {
	const mcp = getHandlers();
	if (!mcp) return NOT_CONFIGURED();
	return mcp.POST(request);
};

export const GET: RequestHandler = async () => {
	const mcp = getHandlers();
	if (!mcp) return NOT_CONFIGURED();
	return mcp.GET();
};

import type { RequestHandler } from "@builder.io/qwik-city";

import { mcpHandler } from "@businessdash/sdk/mcp";

import { getDistributionConfig } from "../../../lib/bd-distribution";

/**
 * `/api/mcp` — this site's MCP connector on its OWN domain. The platform's
 * host-resolved `/api/mcp` only exists on sites BD serves; this proxy gives
 * a self-hosted app the same connector surface, so the URL an org hands to
 * Claude / ChatGPT / Gemini is their own site.
 *
 * Thin by design: the JSON-RPC body is forwarded verbatim and the platform
 * still enforces the org's MCP opt-in and per-tool write gates — a proxy
 * can't widen anything. GET mirrors the spec's 405.
 */

export const onPost: RequestHandler = async ({ request, send }) => {
	const config = getDistributionConfig();
	if (!config) {
		send(
			Response.json(
				{
					jsonrpc: "2.0",
					id: null,
					error: { code: -32603, message: "BD is not configured." },
				},
				{ status: 503 },
			),
		);
		return;
	}
	send(await mcpHandler(config).POST(request));
};

export const onGet: RequestHandler = async ({ send }) => {
	send(new Response(null, { status: 405, headers: { Allow: "POST" } }));
};

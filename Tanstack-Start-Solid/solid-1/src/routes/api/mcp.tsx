import { createFileRoute } from "@tanstack/solid-router";

import {
	buildMcpGetResponse,
	buildMcpPostResponse,
} from "../../lib/bd-server-fns";

/**
 * /api/mcp — this site's MCP connector on its OWN domain. The platform's
 * host-resolved `/api/mcp` only exists on sites BD serves; this proxy gives
 * a self-hosted app the same connector surface, so the URL an org hands to
 * Claude / ChatGPT / Gemini is their own site. Thin by design: the JSON-RPC
 * body is forwarded verbatim and the platform still enforces the org's MCP
 * opt-in and per-tool write gates. GET mirrors the spec's 405.
 */
export const Route = createFileRoute("/api/mcp")({
	server: {
		handlers: {
			GET: () => buildMcpGetResponse(),
			POST: ({ request }) => buildMcpPostResponse(request),
		},
	},
});

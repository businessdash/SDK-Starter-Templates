import { createFileRoute } from "@tanstack/solid-router";

import { buildMcpManifestResponse } from "../lib/bd-server-fns";

/**
 * /.well-known/mcp.json — the MCP discovery manifest, with the endpoint URL
 * rewritten to THIS domain (the requesting origin), so assistants that
 * auto-discover connectors land on the `/api/mcp` proxy next door.
 */
export const Route = createFileRoute("/.well-known/mcp.json")({
	server: {
		handlers: {
			GET: ({ request }) => buildMcpManifestResponse(request),
		},
	},
});

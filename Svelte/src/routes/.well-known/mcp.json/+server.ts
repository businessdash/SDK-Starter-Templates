import { mcpManifestHandler } from "@businessdash/sdk/mcp";

import { aiSurfaceConfig } from "$lib/server/biab-ai";

import type { RequestHandler } from "./$types";

/**
 * GET /.well-known/mcp.json
 *
 * MCP discovery manifest, with the endpoint URL rewritten to THIS domain
 * (the requesting origin) — assistants that support discovery can find the
 * connector at /api/mcp without being handed a URL. (SvelteKit routes
 * normally ignore dot-directories; `.well-known` is the blessed exception.)
 */

let handler: ReturnType<typeof mcpManifestHandler> | null | undefined;

function getHandler() {
	if (handler !== undefined) return handler;
	const cfg = aiSurfaceConfig();
	handler = cfg ? mcpManifestHandler(cfg) : null;
	return handler;
}

export const GET: RequestHandler = async ({ request }) => {
	const manifest = getHandler();
	if (!manifest) {
		return Response.json(
			{ error: "MCP is not configured (set the BIAB env vars)." },
			{ status: 503 },
		);
	}
	return manifest(request);
};

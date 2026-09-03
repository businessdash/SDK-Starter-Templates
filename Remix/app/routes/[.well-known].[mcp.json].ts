import type { LoaderFunctionArgs } from "react-router";

import { mcpManifestHandler } from "@businessdash/sdk/mcp";

import { getDistributionConfig } from "~/lib/bd-distribution.server";

/**
 * `/.well-known/mcp.json` (resource route) — the MCP discovery manifest, with
 * the endpoint URL rewritten to THIS domain (the requesting origin), so
 * assistants that auto-discover connectors land on the `/api/mcp` proxy.
 */

const config = getDistributionConfig();
const handler = config ? mcpManifestHandler(config) : null;

export async function loader({ request }: LoaderFunctionArgs) {
	if (!handler) return Response.json({ error: "not_configured" }, { status: 404 });
	return handler(request);
}

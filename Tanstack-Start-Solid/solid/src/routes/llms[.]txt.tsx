import { createFileRoute } from "@tanstack/solid-router";

import { buildLlmsTxtResponse } from "../lib/bd-server-fns";

/**
 * /llms.txt — the answer-engine index for this site, served from its own
 * domain root (the only place the llms.txt convention works), proxied from
 * the copy the org curates at BD → Marketing → AI Distribution. Upstream
 * 404 passes through untouched (feed disabled or entitlement lapsed);
 * network failure is a plain 503.
 */
export const Route = createFileRoute("/llms.txt")({
	server: {
		handlers: {
			GET: () => buildLlmsTxtResponse(),
		},
	},
});

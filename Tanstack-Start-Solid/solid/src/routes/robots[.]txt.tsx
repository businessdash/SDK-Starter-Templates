import { createFileRoute } from "@tanstack/solid-router";

import { buildRobotsResponse } from "../lib/biab-server-fns";

/**
 * /robots.txt — proxies BIAB's auto-generated robots. The platform
 * switches to `Disallow: /` automatically when billing is fully
 * suspended so crawlers treat the outage as temporary. We forward the
 * upstream body; `Allow: /` is the graceful fallback when unconfigured.
 */
export const Route = createFileRoute("/robots.txt")({
	server: {
		handlers: {
			GET: () => buildRobotsResponse(),
		},
	},
});

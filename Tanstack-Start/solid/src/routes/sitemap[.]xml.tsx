import { createFileRoute } from "@tanstack/solid-router";

import { buildSitemapResponse } from "../lib/biab-server-fns";

/**
 * /sitemap.xml — proxies BIAB's auto-generated sitemap. The platform
 * enumerates every materialised parallel-page URL, applies per-page
 * crawl rules, and switches to an empty body when billing is fully
 * suspended. We forward the upstream body; an empty <urlset/> is the
 * graceful fallback when BIAB isn't configured.
 */
export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: () => buildSitemapResponse(),
		},
	},
});

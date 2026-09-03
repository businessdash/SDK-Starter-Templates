import { createFileRoute } from "@tanstack/solid-router";

import { buildSitemapResponse } from "../lib/bd-server-fns";

/**
 * /sitemap.xml — assembled in `bd-server-fns`, which is where the API key
 * and `process.env` belong. Route files are bundled for the client too, so the
 * server client must not be reached from here.
 */
export const Route = createFileRoute("/sitemap.xml")({
	server: {
		handlers: {
			GET: ({ request }) => buildSitemapResponse(request),
		},
	},
});

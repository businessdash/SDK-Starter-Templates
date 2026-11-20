import { createFileRoute } from "@tanstack/solid-router";

import { buildProductFeedRedirectResponse } from "../lib/bd-server-fns";

/**
 * /ai/product-feed — a stable on-domain link to the site's AI product feed
 * (OpenAI merchant-feed shape, curated at BD → Marketing → AI Distribution).
 * The feed itself needs no proxy: submit the BD URL this route redirects to
 * (`productFeedUrl(...)`) to merchant/feed programs directly.
 */
export const Route = createFileRoute("/ai/product-feed")({
	server: {
		handlers: {
			GET: () => buildProductFeedRedirectResponse(),
		},
	},
});

import { redirect } from "react-router";

import { productFeedUrl } from "@businessdash/sdk/distribution";

import { getDistributionConfig } from "~/lib/biab-distribution.server";

/**
 * `/ai/product-feed` (resource route) — a stable on-domain link to the site's
 * AI product feed (OpenAI merchant-feed shape, curated at BIAB → Marketing →
 * AI Distribution).
 *
 * The feed itself needs no proxy: when you enroll in a merchant/feed program,
 * submit the BIAB URL this route redirects to (`productFeedUrl(...)`)
 * directly. The redirect just gives humans and docs one memorable URL on
 * your own domain.
 */

const config = getDistributionConfig();

export async function loader() {
	if (!config) return new Response("Not found", { status: 404 });
	return redirect(productFeedUrl(config), 307);
}

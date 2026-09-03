import type { RequestHandler } from "@builder.io/qwik-city";

import { productFeedUrl } from "@businessdash/sdk/distribution";

import { getDistributionConfig } from "../../../lib/bd-distribution";

/**
 * `/ai/product-feed` — a stable on-domain link to the site's AI product feed
 * (OpenAI merchant-feed shape, curated at BD → Marketing → AI Distribution).
 *
 * The feed itself needs no proxy: when you enroll in a merchant/feed program,
 * submit the BD URL this route redirects to (`productFeedUrl(...)`)
 * directly. The redirect just gives humans and docs one memorable URL on
 * your own domain.
 */
export const onGet: RequestHandler = async ({ redirect, send }) => {
	const config = getDistributionConfig();
	if (!config) {
		send(new Response("Not found", { status: 404 }));
		return;
	}
	throw redirect(307, productFeedUrl(config));
};

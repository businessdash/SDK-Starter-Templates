import type { RequestHandler } from "@builder.io/qwik-city";

import { llmsTxtHandler } from "@businessdash/sdk/distribution";

import { getDistributionConfig } from "../../lib/biab-distribution";

/**
 * `/llms.txt` — the answer-engine index for this site, served from its own
 * domain root (the only place the llms.txt convention works), proxied from
 * the copy the org curates at BIAB → Marketing → AI Distribution.
 *
 * Upstream 404 passes through untouched (feed disabled or the org's
 * AI Distribution entitlement lapsed); network failure is a plain 503 —
 * the handler never throws into the framework.
 */
export const onGet: RequestHandler = async ({ send }) => {
	const config = getDistributionConfig();
	if (!config) {
		send(new Response("Not found", { status: 404 }));
		return;
	}
	send(await llmsTxtHandler(config)());
};

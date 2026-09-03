import { llmsTxtHandler } from "@businessdash/sdk/distribution";

import { getDistributionConfig } from "@/server/lib/bd-distribution";

/**
 * `/llms.txt` — the answer-engine index for this site, served from its own
 * domain root (the only place the llms.txt convention works), proxied from
 * the copy the org curates at BD → Marketing → AI Distribution.
 *
 * Upstream 404 passes through untouched (feed disabled or the org's
 * AI Distribution entitlement lapsed); network failure is a plain 503 —
 * the handler never throws into the framework.
 */

const config = getDistributionConfig();
const handler = config ? llmsTxtHandler(config) : null;

export async function GET() {
	if (!handler) return new Response("Not found", { status: 404 });
	return handler();
}

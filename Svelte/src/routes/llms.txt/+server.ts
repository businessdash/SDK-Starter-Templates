import { llmsTxtHandler } from "@businessdash/sdk/distribution";

import { aiSurfaceConfig } from "$lib/server/biab-ai";

import type { RequestHandler } from "./$types";

/**
 * GET /llms.txt
 *
 * AEO (answer-engine optimization): serve the org-curated llms.txt from THIS
 * domain's root — the only place AI crawlers look for it — while the source
 * of truth stays on BIAB (Dashboard → Marketing → AI Distribution). The SDK
 * handler proxies the platform artifact, passes an upstream 404 through
 * untouched (feed disabled or entitlement lapsed), and answers 503 on
 * network failure without throwing into SvelteKit.
 *
 * The companion PRODUCT FEED needs no proxy — you submit its BIAB URL
 * directly to merchant/feed programs. Build it with:
 *
 *   import { productFeedUrl } from "@businessdash/sdk/distribution";
 *   productFeedUrl({ siteId, baseUrl }); // → …/api/public/ai-feed/<site>/products
 */

let handler: (() => Promise<Response>) | null | undefined;

function getHandler() {
	if (handler !== undefined) return handler;
	const cfg = aiSurfaceConfig();
	handler = cfg ? llmsTxtHandler(cfg) : null;
	return handler;
}

export const GET: RequestHandler = async () => {
	const proxy = getHandler();
	if (!proxy) {
		return new Response("llms.txt is not configured (set the BIAB env vars).\n", {
			status: 404,
			headers: { "Content-Type": "text/plain; charset=utf-8" },
		});
	}
	return proxy();
};

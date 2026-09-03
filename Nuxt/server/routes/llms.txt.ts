import { llmsTxtHandler } from "@businessdash/sdk/distribution";

/**
 * GET /llms.txt
 *
 * AEO (answer-engine optimization): serve the org-curated llms.txt from THIS
 * domain's root — the only place AI crawlers look for it — while the source
 * of truth stays on BD (Dashboard → Marketing → AI Distribution). The SDK
 * handler proxies the platform artifact, passes an upstream 404 through
 * untouched (feed disabled or entitlement lapsed), and answers 503 on network
 * failure without ever throwing into Nitro.
 *
 * The companion PRODUCT FEED needs no proxy — you submit its BD URL
 * directly to merchant/feed programs. Build it with:
 *
 *   import { productFeedUrl } from "@businessdash/sdk/distribution";
 *   productFeedUrl({ siteId, baseUrl }); // → …/api/public/ai-feed/<site>/products
 */

let handler: (() => Promise<Response>) | null | undefined;

function getHandler() {
	if (handler !== undefined) return handler;
	const cfg = getBdBaseConfig();
	if (!cfg) {
		handler = null;
		return handler;
	}
	// `baseUrl` here is the BD app ORIGIN (e.g. https://www.biab.app), not
	// the package API base — the public ai-feed endpoints live at the host root.
	handler = llmsTxtHandler({ siteId: cfg.siteId, baseUrl: cfg.rawBaseUrl });
	return handler;
}

export default defineEventHandler(async (event) => {
	const proxy = getHandler();
	if (!proxy) {
		setResponseStatus(event, 404);
		setResponseHeader(event, "Content-Type", "text/plain; charset=utf-8");
		return "llms.txt is not configured (set the BD env vars).\n";
	}
	return sendWebResponse(event, await proxy());
});

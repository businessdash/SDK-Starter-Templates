import type { APIRoute } from "astro";

import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";

export const prerender = false;

/**
 * BIAB → consumer webhook receiver.
 *
 * BIAB POSTs a signed `content.published` event here whenever an
 * admin edits content on the BIAB side. The SDK adapter verifies
 * HMAC + replay window and invokes the local callback so this site
 * can flush whatever cache layer it has.
 *
 * Astro SSR re-fetches every render, so today the callback is a
 * logger — but the wiring is in place for when you add response-
 * level caching (Vercel Edge `Cache-Tag` purge, Cloudflare KV
 * delete, static-rebuild trigger, etc.).
 *
 * Register this URL in BIAB's Settings → Integrations and paste
 * the revealed `whsec_…` into `BIAB_REVALIDATION_SECRET`.
 */
const secret =
	import.meta.env.BIAB_REVALIDATION_SECRET ??
	process.env.BIAB_REVALIDATION_SECRET;

const handler = secret
	? createGenericRevalidateHandler({
			secret,
			onTagsRevalidated: async (tags, orgId) => {
				console.info(
					`[biab] revalidate received tags=${tags.join(",")} org=${orgId}`,
				);
				// Plug your cache invalidation here. Example:
				//   await env.PURGE_CACHE.fetch(...)
				//   for (const tag of tags) cdn.purgeByTag(tag);
			},
		})
	: null;

export const POST: APIRoute = async ({ request }) => {
	if (!handler) {
		return Response.json(
			{ ok: false, reason: "BIAB_REVALIDATION_SECRET not configured" },
			{ status: 500 },
		);
	}
	return await handler(request);
};

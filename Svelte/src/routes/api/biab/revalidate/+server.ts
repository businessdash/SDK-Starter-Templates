import { env } from "$env/dynamic/private";
import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";

import type { RequestHandler } from "./$types";

/**
 * BIAB → SvelteKit revalidation webhook receiver.
 *
 * Register this URL in BIAB at /dashboard/settings/integrations and
 * paste the revealed `whsec_…` value into BIAB_REVALIDATION_SECRET.
 *
 * SvelteKit SSR re-fetches every render so the callback is a logger
 * today; when you add response-level caching (Vercel `Cache-Tag`
 * purge, Cloudflare KV delete, etc.), that callback is where to
 * wire it.
 */
const secret = env.BIAB_REVALIDATION_SECRET;

const handler = secret
	? createGenericRevalidateHandler({
			secret,
			onTagsRevalidated: async (tags, orgId) => {
				console.info(
					`[biab] revalidate received tags=${tags.join(",")} org=${orgId}`,
				);
				// Plug your cache invalidation here.
			},
		})
	: null;

export const POST: RequestHandler = async ({ request }) => {
	if (!handler) {
		return new Response(
			JSON.stringify({
				ok: false,
				reason: "BIAB_REVALIDATION_SECRET not configured",
			}),
			{ status: 500, headers: { "Content-Type": "application/json" } },
		);
	}
	return await handler(request);
};

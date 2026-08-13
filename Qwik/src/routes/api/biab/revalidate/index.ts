import type { RequestHandler } from "@builder.io/qwik-city";

import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";

/**
 * BIAB → Qwik revalidation webhook receiver.
 *
 * Register this URL in BIAB at /dashboard/settings/integrations
 * and paste the revealed `whsec_…` value into
 * `BIAB_REVALIDATION_SECRET`. The SDK adapter verifies the HMAC +
 * replay window and invokes the callback so this site can flush
 * whatever cache layer it has.
 *
 * Qwik SSR re-runs `routeLoader$` per request, so today this is a
 * logger — when you add Vercel `Cache-Tag` purge or a Cloudflare
 * KV delete, plug it in below.
 */
const secret = process.env.BIAB_REVALIDATION_SECRET;

const handler = secret
	? createGenericRevalidateHandler({
			secret,
			onTagsRevalidated: async (tags, orgId) => {
				console.info(
					`[biab] revalidate received tags=${tags.join(",")} org=${orgId}`,
				);
			},
		})
	: null;

export const onPost: RequestHandler = async ({ request, send }) => {
	if (!handler) {
		send(
			500,
			JSON.stringify({
				ok: false,
				reason: "BIAB_REVALIDATION_SECRET not configured",
			}),
		);
		return;
	}
	const res = await handler(request);
	const body = await res.text();
	send(res.status, body);
};

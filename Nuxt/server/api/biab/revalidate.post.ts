import { createGenericRevalidateHandler } from "@businessdash/sdk/adapters/revalidate";

/**
 * BIAB → Nuxt revalidation webhook receiver.
 *
 * Register this URL in BIAB at /dashboard/settings/integrations
 * and paste the revealed `whsec_…` value into
 * `NUXT_BIAB_REVALIDATION_SECRET`. The SDK adapter verifies the
 * HMAC + replay window and invokes the callback so this app can
 * flush whatever cache layer it has.
 */
const handler = (() => {
	const secret = useRuntimeConfig().biabRevalidationSecret;
	if (!secret) return null;
	return createGenericRevalidateHandler({
		secret,
		onTagsRevalidated: async (tags, orgId) => {
			console.info(
				`[biab] revalidate received tags=${tags.join(",")} org=${orgId}`,
			);
			// Plug response-level cache invalidation here when added.
		},
	});
})();

export default defineEventHandler(async (event) => {
	if (!handler) {
		setResponseStatus(event, 500);
		return {
			ok: false,
			reason: "NUXT_BIAB_REVALIDATION_SECRET not configured",
		};
	}
	const request = toWebRequest(event);
	const res = await handler(request);
	setResponseStatus(event, res.status);
	return await res.json();
});

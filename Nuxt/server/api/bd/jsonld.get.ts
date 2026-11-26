import { localBusiness, website } from "@businessdash/sdk/seo";

/**
 * GET /api/bd/jsonld
 *
 * Build the site's JSON-LD (LocalBusiness + WebSite) server-side from
 * the SDK's SEO builders and return each node as a JSON string. The home
 * page gives each its own `<script type="application/ld+json">` in the
 * head via `useHead`, so crawlers see structured data in the
 * server-rendered HTML. They're the scripts' bodies, not whole tags: a
 * tag inside another would leave crawlers JSON they can't read.
 *
 * Company facts come from the marketing bundle (same source as the home
 * aggregator). Falls back to generic placeholder identity when BD
 * isn't configured, so the tags are always valid.
 */
export type JsonLdResult = { nodes: string[] };

const DEFAULT_NAME = "Your Business";

export default defineEventHandler(async (event): Promise<JsonLdResult> => {
	// Reuse the home aggregator's resolved company profile + site origin.
	const home = await $fetch<{ company: { name?: string | null; phone?: string | null; email?: string | null; city?: string | null } }>(
		"/api/bd/home",
	);
	const siteUrl = getRequestURL(event).origin;
	const name = home.company.name?.trim() || DEFAULT_NAME;

	const nodes = [
		localBusiness({
			siteUrl,
			name,
			...(home.company.phone ? { telephone: home.company.phone } : {}),
			...(home.company.email ? { email: home.company.email } : {}),
			...(home.company.city
				? { address: { addressLocality: home.company.city } }
				: {}),
		}),
		website({ siteUrl, name }),
	];

	// `<` escaped so no value can close the script tag early.
	return { nodes: nodes.map((node) => JSON.stringify(node).replace(/</g, "\\u003c")) };
});

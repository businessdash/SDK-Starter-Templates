import { localBusiness, website, renderJsonLdToHtml } from "@businessdash/sdk/seo";

/**
 * GET /api/bd/jsonld
 *
 * Build the site's JSON-LD (LocalBusiness + WebSite) server-side from
 * the SDK's SEO builders and return it as a single HTML string of
 * `<script type="application/ld+json">` tags. The home page injects it
 * into the document head via `useHead`, so crawlers see structured data
 * in the server-rendered HTML.
 *
 * Company facts come from the marketing bundle (same source as the home
 * aggregator). Falls back to generic placeholder identity when BD
 * isn't configured, so the tags are always valid.
 */
export type JsonLdResult = { html: string };

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

	return { html: renderJsonLdToHtml(nodes) };
});

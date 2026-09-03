import {
	localBusiness,
	renderJsonLdToHtml,
	website,
	type JsonLdNode,
} from "@businessdash/sdk/seo";

import type { MarketingBundle } from "./bd-bundle";

/**
 * Server-side JSON-LD. We build `LocalBusiness` + `WebSite` nodes from the
 * company profile on the marketing bundle (falling back to starter defaults)
 * and render them to a `<script type="application/ld+json">` string that the
 * layout injects with `set:html` into the document `<head>`.
 *
 * Crawlers see fully-resolved structured data on first paint — no client JS.
 */

export type SeoInput = {
	siteUrl: string;
	name: string;
	description?: string;
	telephone?: string;
	email?: string;
};

const STARTER_DEFAULTS: SeoInput = {
	siteUrl: "https://example.com",
	name: "Your Business",
	description:
		"A small local business built on BD — book online, browse the gallery, read reviews.",
};

/** Pull a usable SEO seed off the bundle's `company` profile, if present. */
export function seoFromBundle(bundle: MarketingBundle | null): SeoInput {
	const company = (
		bundle as unknown as {
			company?: {
				profile?: {
					name?: string | null;
					description?: string | null;
					phone?: string | null;
					email?: string | null;
					domain?: string | null;
				} | null;
			} | null;
		} | null
	)?.company?.profile;
	if (!company) return STARTER_DEFAULTS;
	const domain = company.domain?.trim();
	return {
		siteUrl: domain
			? domain.startsWith("http")
				? domain
				: `https://${domain}`
			: STARTER_DEFAULTS.siteUrl,
		name: company.name?.trim() || STARTER_DEFAULTS.name,
		description: company.description?.trim() || STARTER_DEFAULTS.description,
		telephone: company.phone?.trim() || undefined,
		email: company.email?.trim() || undefined,
	};
}

/** Build the `<script>` JSON-LD HTML for the document head. */
export function renderSiteJsonLd(input: SeoInput): string {
	const nodes: JsonLdNode[] = [
		localBusiness({
			siteUrl: input.siteUrl,
			name: input.name,
			description: input.description,
			telephone: input.telephone,
			email: input.email,
		}),
		website({
			siteUrl: input.siteUrl,
			name: input.name,
			description: input.description,
		}),
	];
	return renderJsonLdToHtml(nodes);
}

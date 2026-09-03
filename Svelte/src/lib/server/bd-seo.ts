import { localBusiness, renderJsonLdToHtml, website } from "@businessdash/sdk/seo";

/**
 * Server-side JSON-LD builders. `+page.server.ts` calls `buildHomeJsonLd`
 * and passes the returned HTML string to the page, which injects it into
 * `<svelte:head>` with `{@html ...}`. Crawlers see fully-rendered
 * structured data on the first byte (SSR), no client hydration needed.
 *
 * Values come from the marketing bundle's `companyInfo`/`brand` sections
 * when present and fall back to template placeholders otherwise, so the
 * markup is always valid even before BD is wired up.
 */
export type SeoCompany = {
	name: string;
	siteUrl: string;
	description?: string;
	telephone?: string;
	email?: string;
	city?: string;
};

/** Build `LocalBusiness` + `WebSite` JSON-LD as a ready-to-inject HTML string. */
export function buildHomeJsonLd(company: SeoCompany): string {
	const nodes = [
		localBusiness({
			siteUrl: company.siteUrl,
			name: company.name,
			description: company.description,
			telephone: company.telephone,
			email: company.email,
			areaServed: company.city ? [company.city] : undefined,
		}),
		website({
			siteUrl: company.siteUrl,
			name: company.name,
			description: company.description,
		}),
	];
	return renderJsonLdToHtml(nodes);
}

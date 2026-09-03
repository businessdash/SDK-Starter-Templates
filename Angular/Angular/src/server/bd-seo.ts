/**
 * Server-side JSON-LD for the home document.
 *
 * Built from the marketing bundle's company/brand data using the SDK's
 * `localBusiness` + `website` builders, then injected into the rendered
 * <head> before the HTML is sent — so crawlers see structured data even
 * though the rest of the page hydrates client-side.
 *
 * No-ops (returns "") when BD env is unset.
 */

import { localBusiness, website, renderJsonLdToHtml } from "@businessdash/sdk/seo";
import { getPageBundle, sectionData, runGuarded } from "./bd-server";

type CompanyInfo = {
	name?: string;
	city?: string;
	phone?: string;
	email?: string;
	domain?: string;
};
type Brand = { siteTitle?: string; siteDescription?: string };

/** Returns a `<script type="application/ld+json">…</script>` block, or "". */
export async function buildHomeJsonLd(): Promise<string> {
	const guarded = await runGuarded(() => getPageBundle("home", "en"));
	if (!guarded.ok || !guarded.data) return "";
	const bundle = guarded.data;

	const company = sectionData<CompanyInfo>(bundle, "companyInfo") ?? {};
	const brand = sectionData<Brand>(bundle, "brand") ?? {};

	const siteUrl = company.domain
		? `https://${company.domain.replace(/^https?:\/\//, "")}`
		: "https://example.com";
	const name = company.name ?? brand.siteTitle ?? "Your Business";

	const nodes = [
		localBusiness({
			siteUrl,
			name,
			...(brand.siteDescription ? { description: brand.siteDescription } : {}),
			...(company.phone ? { telephone: company.phone } : {}),
			...(company.email ? { email: company.email } : {}),
			...(company.city ? { areaServed: [company.city] } : {}),
		}),
		website({
			siteUrl,
			name,
			...(brand.siteDescription ? { description: brand.siteDescription } : {}),
		}),
	];

	return renderJsonLdToHtml(nodes);
}

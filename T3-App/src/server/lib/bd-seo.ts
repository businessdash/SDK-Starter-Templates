import "server-only";

import { type JsonLdNode, localBusiness, website } from "@businessdash/sdk/seo";

import { getBdBundle, readBundleSection } from "@/server/lib/bd";

/**
 * Server-side JSON-LD. Builds `LocalBusiness` + `WebSite` nodes from the BD
 * marketing bundle (falling back to template defaults when unconfigured), so
 * search crawlers see structured data on the home page. Injected via a
 * `<script type="application/ld+json">` rendered server-side in the page.
 */

const SITE_URL = process.env.NEXT_PUBLIC_SITE_URL ?? "https://example.com";
const DEFAULT_NAME = "Your Business";
const DEFAULT_DESCRIPTION =
	"Local service you can count on — book online, see real reviews, and get fast follow-up.";

type CompanyInfo = {
	name?: string;
	phone?: string;
	email?: string;
	city?: string;
	address?: string;
};

/** Build the JSON-LD node list for the home page from the bundle (or defaults). */
export async function homeJsonLd(): Promise<JsonLdNode[]> {
	const bundle = await getBdBundle("home").catch(() => null);
	const company = (readBundleSection(bundle, "companyInfo") ??
		readBundleSection(bundle, "company")) as CompanyInfo | null;
	const brand = readBundleSection(bundle, "brand") as {
		siteTitle?: string;
		siteDescription?: string;
	} | null;

	const name = company?.name ?? brand?.siteTitle ?? DEFAULT_NAME;
	const description = brand?.siteDescription ?? DEFAULT_DESCRIPTION;

	return [
		localBusiness({
			siteUrl: SITE_URL,
			name,
			description,
			telephone: company?.phone,
			email: company?.email,
			address: company?.city ? { addressLocality: company.city } : undefined,
		}),
		website({
			siteUrl: SITE_URL,
			name,
			description,
		}),
	];
}

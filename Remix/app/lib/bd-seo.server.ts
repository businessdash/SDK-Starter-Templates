import { localBusiness, renderJsonLdToHtml, website } from "@businessdash/sdk/seo";

import { getSectionData, type MarketingBundle } from "./bd-bundle.server";

/**
 * Server-rendered JSON-LD (server-only).
 *
 * Builds `localBusiness` + `website` nodes from the marketing bundle's
 * company/brand data (falling back to starter defaults) and serializes them
 * to a `<script type="application/ld+json">` HTML string. The home route
 * injects this string via `dangerouslySetInnerHTML` so crawlers see the
 * structured data on first render.
 */

const SITE_URL = process.env["BD_SITE_URL"] ?? "https://example.com";

const DEFAULTS = {
	name: "Your Business",
	description:
		"Local service business — book online, fast and reliable.",
	telephone: "",
	email: "",
};

/** Build the JSON-LD HTML string for the home page from the bundle. */
export function buildHomeJsonLd(bundle: MarketingBundle | null): string {
	const company = getSectionData(bundle, "companyInfo");
	const brand = getSectionData(bundle, "brand");

	const name = pickString(company?.["name"]) ?? DEFAULTS.name;
	const description =
		pickString(brand?.["siteDescription"]) ?? DEFAULTS.description;
	const telephone = pickString(company?.["phone"]) ?? DEFAULTS.telephone;
	const email = pickString(company?.["email"]) ?? DEFAULTS.email;
	const city = pickString(company?.["city"]);

	const nodes = [
		localBusiness({
			siteUrl: SITE_URL,
			name,
			description,
			...(telephone ? { telephone } : {}),
			...(email ? { email } : {}),
			...(city ? { address: { addressLocality: city } } : {}),
		}),
		website({ siteUrl: SITE_URL, name, description }),
	];

	return renderJsonLdToHtml(nodes);
}

function pickString(v: unknown): string | undefined {
	if (typeof v !== "string") return undefined;
	const t = v.trim();
	return t ? t : undefined;
}

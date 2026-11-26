import { localBusiness, website } from "@businessdash/sdk/seo";

import { getSectionData, type MarketingBundle } from "./bd-bundle.server";

/**
 * Server-rendered JSON-LD (server-only).
 *
 * Builds `localBusiness` + `website` nodes from the marketing bundle's
 * company/brand data (falling back to starter defaults) and serializes each
 * to JSON for its own `<script type="application/ld+json">`, which the home
 * route renders so crawlers see the structured data on first render.
 */

const SITE_URL = process.env["BD_SITE_URL"] ?? "https://example.com";

const DEFAULTS = {
	name: "Your Business",
	description:
		"Local service business — book online, fast and reliable.",
	telephone: "",
	email: "",
};

/**
 * The home page's JSON-LD, one JSON string per node. Each is the body of a
 * script tag, not the tag itself: React renders the tag, and a whole
 * `<script>` inside another would end it early. `<` is escaped so a
 * value can't close the tag either.
 */
export function buildHomeJsonLd(bundle: MarketingBundle | null): string[] {
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

	return nodes.map((node) => JSON.stringify(node).replace(/</g, "\\u003c"));
}

function pickString(v: unknown): string | undefined {
	if (typeof v !== "string") return undefined;
	const t = v.trim();
	return t ? t : undefined;
}

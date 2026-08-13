import { error } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

import { renderServiceArea } from "$lib/server/biab-parallel";

/**
 * One programmatic (service × area) page, rendered server-side via
 * `parallelPages.render("service-area", { service, area })`. Token
 * resolution (`{service.type}`, `{area.name}`, …) happens inside BIAB so
 * crawlers receive fully-resolved HTML.
 *
 * Billing-suspension errors become a 503 (temporary outage — SEO-safe);
 * a missing/unknown variant becomes a 404.
 */
export const load: PageServerLoad = async ({ params }) => {
	const result = await renderServiceArea(params.service, params.area);

	if (result.status === "unavailable") {
		throw error(503, "This page is temporarily unavailable.");
	}
	if (!result.variant) {
		throw error(404, "Page not found.");
	}

	const variant = result.variant;
	const body = (variant.body ?? null) as {
		PageTitle?: string;
		PageHeadline?: string;
	} | null;

	return {
		meta: {
			title: variant.meta.title,
			description: variant.meta.description,
			canonical: variant.meta.canonical ?? null,
			ogImage: variant.meta.ogImage ?? null,
		},
		body,
	};
};

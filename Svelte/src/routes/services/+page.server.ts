import type { PageServerLoad } from "./$types";

import { listServiceAreaVariants } from "$lib/server/biab-parallel";

/**
 * Index of every programmatic (service × area) page. SvelteKit doesn't do
 * Next-style `generateStaticParams`, so we enumerate the variants here and
 * link to each `/services/[service]/[area]` SSR route. The platform fans
 * the `service-area` template out into one URL per combination — this
 * page is the human-readable directory; the sitemap is the crawler's.
 */
export const load: PageServerLoad = async () => {
	const variants = await listServiceAreaVariants();
	return { variants };
};

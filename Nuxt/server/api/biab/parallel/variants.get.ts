/**
 * GET /api/biab/parallel/variants?key=service-area
 *
 * The list of materialised (service × area) variants for a parallel-page
 * key. Each variant is a plain `{ service, area }` record (the slug
 * fields declared in `biab.config.ts`). The `/services/[service]/[area]`
 * index page uses this to render its link list.
 *
 * Returns an empty list when BIAB isn't configured.
 */
export type ParallelVariantsResult = {
	variants: Array<Record<string, string>>;
};

export default defineEventHandler(
	async (event): Promise<ParallelVariantsResult> => {
		const biab = getBiab();
		if (!biab) return { variants: [] };
		const key = (getQuery(event).key as string) || "service-area";
		try {
			const res = await biab.parallelPages.listVariants(key);
			return { variants: res.variants };
		} catch {
			return { variants: [] };
		}
	},
);

/**
 * GET /api/bd/parallel/variants?key=service-area
 *
 * The list of materialised (service × area) variants for a parallel-page
 * key. Each variant is a plain `{ service, area }` record (the slug
 * fields declared in `bd.config.ts`). The `/services/[service]/[area]`
 * index page uses this to render its link list.
 *
 * Returns an empty list when BD isn't configured.
 */
export type ParallelVariantsResult = {
	variants: Array<Record<string, string>>;
};

export default defineEventHandler(
	async (event): Promise<ParallelVariantsResult> => {
		const bd = getBd();
		if (!bd) return { variants: [] };
		const key = (getQuery(event).key as string) || "service-area";
		try {
			const res = await bd.parallelPages.listVariants(key);
			return { variants: res.variants };
		} catch {
			return { variants: [] };
		}
	},
);

import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";
import type {
	StorefrontCategory,
	StorefrontProductsWithMetaResponse,
	StorefrontSort,
} from "@businessdash/sdk/contracts";

/**
 * GET /api/bd/store/products-meta
 *
 * Filterable storefront grid + facets — the data behind a full shop page.
 * Wraps `storefront.listProductsWithMeta` (enriched per-card price/ratings/
 * badges, `categoryCounts`, `priceRange`) and joins `listCategories` so the
 * sidebar can label each category-count by name. Accepts the same filters the
 * SDK does: `search`, `categoryId`, `minPriceCents`/`maxPriceCents`,
 * `minRating` (1–5), and `sort` (featured | newest | price-asc | price-desc |
 * rating-desc).
 *
 * Degrades to an empty result (no items, empty facets) when BD is
 * unconfigured, and to `suspended: true` when billing is suspended — so the
 * page renders a sensible state instead of crashing.
 */
const SORT_VALUES: readonly StorefrontSort[] = [
	"featured",
	"newest",
	"price-asc",
	"price-desc",
	"rating-desc",
];

export type StoreProductsMetaResult = {
	items: StorefrontProductsWithMetaResponse["items"];
	categoryCounts: StorefrontProductsWithMetaResponse["categoryCounts"];
	priceRange: StorefrontProductsWithMetaResponse["priceRange"];
	categories: StorefrontCategory[];
	suspended: boolean;
};

const EMPTY: StoreProductsMetaResult = {
	items: [],
	categoryCounts: [],
	priceRange: { minDollars: 0, maxDollars: 0 },
	categories: [],
	suspended: false,
};

export default defineEventHandler(
	async (event): Promise<StoreProductsMetaResult> => {
		const bd = getBd();
		if (!bd) return EMPTY;

		const query = getQuery(event);
		const search = (query.search as string) || undefined;
		const categoryId = (query.categoryId as string) || undefined;
		const minPriceCents =
			query.minPriceCents != null ? Number(query.minPriceCents) : undefined;
		const maxPriceCents =
			query.maxPriceCents != null ? Number(query.maxPriceCents) : undefined;
		const minRating =
			query.minRating != null ? Number(query.minRating) : undefined;
		const sortRaw = query.sort as StorefrontSort | undefined;
		const sort =
			sortRaw && SORT_VALUES.includes(sortRaw) ? sortRaw : undefined;
		const limit = query.limit != null ? Number(query.limit) : 48;

		try {
			const [meta, cats] = await Promise.all([
				bd.storefront.listProductsWithMeta({
					limit,
					...(search ? { search } : {}),
					...(categoryId ? { categoryId } : {}),
					...(minPriceCents != null ? { minPriceCents } : {}),
					...(maxPriceCents != null ? { maxPriceCents } : {}),
					...(minRating != null ? { minRating } : {}),
					...(sort ? { sort } : {}),
				}),
				// Categories are best-effort (sidebar labels) — never fail the grid.
				bd.storefront.listCategories().catch(() => ({ items: [] })),
			]);
			return {
				items: meta.items,
				categoryCounts: meta.categoryCounts,
				priceRange: meta.priceRange,
				categories: cats.items,
				suspended: false,
			};
		} catch (err) {
			if (
				err instanceof BdServiceSuspendedError ||
				err instanceof BdPaymentLapsedError
			) {
				return { ...EMPTY, suspended: true };
			}
			return EMPTY;
		}
	},
);

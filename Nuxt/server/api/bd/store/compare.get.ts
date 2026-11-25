// [bd-file:store]
import type { StorefrontProductDetail } from "@businessdash/sdk/contracts";

/**
 * GET /api/bd/store/compare?ids=a,b,c
 *
 * Up to four products for the compare table, each with its review average.
 * Products that can't be found are left out.
 */
export type CompareColumn = {
	product: StorefrontProductDetail;
	rating: { avg: number; count: number } | null;
};

export default defineEventHandler(
	async (event): Promise<{ columns: CompareColumn[] }> => {
		const bd = getBd();
		const ids = String(getQuery(event).ids ?? "")
			.split(",")
			.map((id) => id.trim())
			.filter(Boolean)
			.slice(0, 4);
		if (!bd || ids.length === 0) return { columns: [] };
		const columns = await Promise.all(
			ids.map(async (id): Promise<CompareColumn | null> => {
				const [product, reviews] = await Promise.all([
					bd.storefront.getProduct(id).catch(() => null),
					bd.storefront.getProductReviews(id, { limit: 1 }).catch(() => null),
				]);
				if (!product) return null;
				return {
					product,
					rating:
						reviews && reviews.totalCount > 0
							? { avg: reviews.avgRating, count: reviews.totalCount }
							: null,
				};
			}),
		);
		return {
			columns: columns.filter((c): c is CompareColumn => c !== null),
		};
	},
);

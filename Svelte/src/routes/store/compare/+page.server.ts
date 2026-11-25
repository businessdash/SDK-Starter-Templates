// [bd-file:store]
import type { PageServerLoad } from './$types';

import { toProductView, type ProductView } from '#lib/bd/shop.ts';
import {
	getCartSnapshot,
	getStoreProduct,
	getStoreProductReviews,
	isStoreConfigured
} from '#lib/server/bd-store.ts';

/**
 * The compare table: up to four products side by side (`?ids=a,b,c`). The
 * picks live in the visitor's browser; the page sends them here in the URL,
 * so a comparison can be bookmarked or shared.
 */
export type CompareColumn = {
	view: ProductView;
	rating: { avg: number; count: number } | null;
};

export const load: PageServerLoad = async ({ url, cookies }) => {
	const ids = (url.searchParams.get('ids') ?? '')
		.split(',')
		.map((id) => id.trim())
		.filter(Boolean)
		.slice(0, 4);
	const cart = await getCartSnapshot(cookies);
	if (!isStoreConfigured() || ids.length === 0) {
		return {
			configured: isStoreConfigured(),
			ids,
			columns: [] as CompareColumn[],
			cartCount: cart?.itemCount ?? 0
		};
	}
	const columns = await Promise.all(
		ids.map(async (id): Promise<CompareColumn | null> => {
			const [product, reviews] = await Promise.all([
				getStoreProduct(id),
				getStoreProductReviews(id, { limit: 1 })
			]);
			if (!product) return null;
			return {
				view: toProductView(product),
				rating:
					reviews && reviews.totalCount > 0
						? { avg: reviews.avgRating, count: reviews.totalCount }
						: null
			};
		})
	);
	return {
		configured: true,
		ids,
		columns: columns.filter((column): column is CompareColumn => column !== null),
		cartCount: cart?.itemCount ?? 0
	};
};

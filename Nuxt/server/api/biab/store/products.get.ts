import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
} from "@businessdash/sdk";
import type { StorefrontListProductsResponse } from "@businessdash/sdk/contracts";

/**
 * GET /api/biab/store/products
 *
 * Live storefront product list. Returns `{ products: [], suspended }`
 * shapes so the store page can render an empty grid (unconfigured) or
 * a "temporarily unavailable" notice (billing suspended) without
 * crashing.
 */
export type StoreProductsResult = {
	products: StorefrontListProductsResponse["items"];
	nextCursor: number | null;
	suspended: boolean;
};

export default defineEventHandler(
	async (event): Promise<StoreProductsResult> => {
		const biab = getBiab();
		if (!biab) return { products: [], nextCursor: null, suspended: false };

		const query = getQuery(event);
		const limit = query.limit ? Number(query.limit) : 24;
		const cursor = query.cursor != null ? Number(query.cursor) : undefined;
		const categoryId = (query.categoryId as string) || undefined;

		try {
			const res = await biab.storefront.listProducts({
				limit,
				...(cursor != null ? { cursor } : {}),
				...(categoryId ? { categoryId } : {}),
			});
			return {
				products: res.items,
				nextCursor: res.nextCursor,
				suspended: false,
			};
		} catch (err) {
			if (
				err instanceof BiabServiceSuspendedError ||
				err instanceof BiabPaymentLapsedError
			) {
				return { products: [], nextCursor: null, suspended: true };
			}
			return { products: [], nextCursor: null, suspended: false };
		}
	},
);

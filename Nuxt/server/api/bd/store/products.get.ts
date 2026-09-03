import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";
import type { StorefrontListProductsResponse } from "@businessdash/sdk/contracts";

/**
 * GET /api/bd/store/products
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
		const bd = getBd();
		if (!bd) return { products: [], nextCursor: null, suspended: false };

		const query = getQuery(event);
		const limit = query.limit ? Number(query.limit) : 24;
		const cursor = query.cursor != null ? Number(query.cursor) : undefined;
		const categoryId = (query.categoryId as string) || undefined;

		try {
			const res = await bd.storefront.listProducts({
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
				err instanceof BdServiceSuspendedError ||
				err instanceof BdPaymentLapsedError
			) {
				return { products: [], nextCursor: null, suspended: true };
			}
			return { products: [], nextCursor: null, suspended: false };
		}
	},
);

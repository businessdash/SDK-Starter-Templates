import {
	BiabPaymentLapsedError,
	BiabServiceSuspendedError,
} from "@businessdash/sdk";
import type { StorefrontProductDetail } from "@businessdash/sdk/contracts";

/**
 * GET /api/biab/store/product/[id]
 *
 * Single product detail (with variants + images). Returns
 * `{ product: null }` when the store is unconfigured, the product
 * doesn't exist, or billing is suspended.
 */
export type StoreProductResult = {
	product: StorefrontProductDetail | null;
	suspended: boolean;
};

export default defineEventHandler(
	async (event): Promise<StoreProductResult> => {
		const biab = getBiab();
		if (!biab) return { product: null, suspended: false };
		const id = getRouterParam(event, "id");
		if (!id) return { product: null, suspended: false };
		try {
			const product = await biab.storefront.getProduct(id);
			return { product, suspended: false };
		} catch (err) {
			if (
				err instanceof BiabServiceSuspendedError ||
				err instanceof BiabPaymentLapsedError
			) {
				return { product: null, suspended: true };
			}
			return { product: null, suspended: false };
		}
	},
);

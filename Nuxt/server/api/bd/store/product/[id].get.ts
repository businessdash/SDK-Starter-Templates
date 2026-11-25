// [bd-file:store]
import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";
import type {
	StorefrontAddonsResponse,
	StorefrontProductDetail,
	StorefrontProductReviewsResponse,
	StorefrontRelatedProductsResponse,
} from "@businessdash/sdk/contracts";

/**
 * GET /api/bd/store/product/[id]?reviews=10
 *
 * Everything the product page shows: the product (variants, photos, option
 * groups, specs), its reviews (`?reviews=` how many, 10 to 100), add-ons and
 * related products. The extras are fetched together and each falls back to
 * empty on its own, so a failing one never hides the product. Returns
 * `{ product: null }` when the store is unconfigured, the product doesn't
 * exist, or billing is suspended.
 */
export type StoreProductResult = {
	product: StorefrontProductDetail | null;
	reviews: StorefrontProductReviewsResponse | null;
	addons: StorefrontAddonsResponse["items"];
	related: StorefrontRelatedProductsResponse["items"];
	reviewLimit: number;
	suspended: boolean;
};

const REVIEWS_PAGE = 10;

export default defineEventHandler(
	async (event): Promise<StoreProductResult> => {
		const shown = Number.parseInt(String(getQuery(event).reviews ?? ""), 10);
		const reviewLimit = Number.isFinite(shown)
			? Math.min(Math.max(shown, REVIEWS_PAGE), 100)
			: REVIEWS_PAGE;
		const empty: StoreProductResult = {
			product: null,
			reviews: null,
			addons: [],
			related: [],
			reviewLimit,
			suspended: false,
		};
		const bd = getBd();
		const id = getRouterParam(event, "id");
		if (!bd || !id) return empty;
		try {
			const [product, reviews, addons, related] = await Promise.all([
				bd.storefront.getProduct(id),
				bd.storefront
					.getProductReviews(id, { limit: reviewLimit })
					.catch(() => null),
				bd.storefront
					.getProductAddons(id)
					.then((res) => res.items)
					.catch(() => []),
				bd.storefront
					.getRelatedProducts(id, { limit: 8 })
					.then((res) => res.items)
					.catch(() => []),
			]);
			return { product, reviews, addons, related, reviewLimit, suspended: false };
		} catch (err) {
			if (
				err instanceof BdServiceSuspendedError ||
				err instanceof BdPaymentLapsedError
			) {
				return { ...empty, suspended: true };
			}
			return empty;
		}
	},
);

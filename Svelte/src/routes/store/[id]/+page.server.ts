import { error } from "@sveltejs/kit";

import type { PageServerLoad } from "./$types";

import {
	getCartSnapshot,
	getStoreProduct,
	getStoreProductAddons,
	getStoreProductReviews,
	getStoreRelatedProducts,
	isStoreConfigured,
} from "$lib/server/biab-store";

/**
 * Product detail. Resolves the full product (with variants) via
 * `storefront.getProduct`, plus reviews (avgRating/totalCount), an addons
 * rail, related products, and the current cart count. The enrichment calls
 * degrade to null/empty independently, so the page still renders if any of
 * them are unavailable. 404s when the product isn't live / doesn't belong to
 * this org (the SDK throws); renders the "not connected" placeholder when
 * BIAB env is unset.
 */
export const load: PageServerLoad = async ({ params, cookies }) => {
	if (!isStoreConfigured()) {
		return {
			configured: false as const,
			product: null,
			reviews: null,
			addons: [],
			related: [],
			cartCount: 0,
		};
	}

	const product = await getStoreProduct(params.id);
	if (!product) throw error(404, "Product not found.");

	const [reviews, addons, related, cart] = await Promise.all([
		getStoreProductReviews(params.id),
		getStoreProductAddons(params.id),
		getStoreRelatedProducts(params.id),
		getCartSnapshot(cookies),
	]);

	return {
		configured: true as const,
		product,
		reviews,
		addons: addons ?? [],
		related: related ?? [],
		cartCount: cart?.itemCount ?? 0,
	};
};

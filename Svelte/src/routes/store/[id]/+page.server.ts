// [bd-file:store]
import { error } from '@sveltejs/kit';

import type { PageServerLoad } from './$types';

import {
	getCartSnapshot,
	getStoreProduct,
	getStoreProductAddons,
	getStoreProductReviews,
	getStoreRelatedProducts,
	isStoreConfigured
} from '#lib/server/bd-store.ts';

/**
 * Product detail. Resolves the full product (with variants) via
 * `storefront.getProduct`, plus reviews (avgRating/totalCount), an addons
 * rail, related products, and the current cart count. `?reviews=40` shows
 * more reviews, so "Show more" works without JavaScript. The enrichment calls
 * degrade to null/empty independently, so the page still renders if any of
 * them are unavailable. 404s when the product isn't live / doesn't belong to
 * this org (the SDK throws); renders the "not connected" placeholder when
 * BD env is unset.
 */
const REVIEWS_PAGE = 10;

export const load: PageServerLoad = async ({ params, cookies, url }) => {
	const shown = Number.parseInt(url.searchParams.get('reviews') ?? '', 10);
	const reviewLimit = Number.isFinite(shown)
		? Math.min(Math.max(shown, REVIEWS_PAGE), 100)
		: REVIEWS_PAGE;

	if (!isStoreConfigured()) {
		return {
			configured: false as const,
			product: null,
			reviews: null,
			addons: [],
			related: [],
			cartCount: 0,
			reviewLimit,
			shareUrl: url.href
		};
	}

	const product = await getStoreProduct(params.id);
	if (!product) throw error(404, 'Product not found.');

	const [reviews, addons, related, cart] = await Promise.all([
		getStoreProductReviews(params.id, { limit: reviewLimit }),
		getStoreProductAddons(params.id),
		getStoreRelatedProducts(params.id),
		getCartSnapshot(cookies)
	]);

	return {
		configured: true as const,
		product,
		reviews,
		addons: addons ?? [],
		related: related ?? [],
		cartCount: cart?.itemCount ?? 0,
		reviewLimit,
		shareUrl: url.origin + url.pathname
	};
};

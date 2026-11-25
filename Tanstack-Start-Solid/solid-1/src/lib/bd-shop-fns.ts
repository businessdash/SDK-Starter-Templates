// [bd-file:store]
/**
 * Server functions for the shop's pages: the product page, the comparison,
 * the order confirmation, and the cart count for the store bar. The pages
 * hand the results to the shop's custom elements (src/lib/shop/).
 */
import { createServerFn } from "@tanstack/solid-start";

import { devwarn, getBd } from "./bd";
import { getCart, isSuspensionError } from "./bd-server-fns";
import type { ProductPageData } from "./shop/shop";
import type { CompareColumn } from "./shop/shop-elements";

/** SDK records have open `[key: string]: unknown` fields that fail the
 *  output type check though they serialize fine (see bd-server-fns.ts). */
const SDK_OUTPUT = { output: false } as const;

/** Reviews shown at first; each "Show more" adds this many (?reviews=20). */
export const REVIEWS_PAGE = 10;

export type ProductPageResult =
	| { ok: true; data: ProductPageData }
	| { ok: false; reason: "unconfigured" | "suspended" | "notfound" };

/** One product with its reviews, add-ons and related products, for `<ProductDetail>`. */
export const getProductPage = createServerFn({
	method: "GET",
	strict: SDK_OUTPUT,
})
	.validator((data: { id: string; reviews?: number }) => data)
	.handler(async ({ data }): Promise<ProductPageResult> => {
		const bd = getBd();
		if (!bd) return { ok: false, reason: "unconfigured" };
		const limit = Math.min(
			100,
			data.reviews && data.reviews > REVIEWS_PAGE ? data.reviews : REVIEWS_PAGE,
		);
		try {
			const [product, reviews, addons, related] = await Promise.all([
				bd.storefront.getProduct(data.id),
				bd.storefront.getProductReviews(data.id, { limit }).catch((err) => {
					devwarn("storefront.getProductReviews", err);
					return null;
				}),
				bd.storefront
					.getProductAddons(data.id)
					.then((res) => res.items)
					.catch(() => []),
				bd.storefront
					.getRelatedProducts(data.id, { limit: 6 })
					.then((res) => res.items)
					.catch(() => []),
			]);
			return {
				ok: true,
				data: {
					product,
					reviews,
					addons,
					related,
					moreReviewsHref:
						reviews && reviews.totalCount > reviews.items.length
							? `/store/${encodeURIComponent(data.id)}?reviews=${limit + REVIEWS_PAGE}#reviews`
							: null,
				},
			};
		} catch (err) {
			if (isSuspensionError(err)) return { ok: false, reason: "suspended" };
			devwarn("storefront.getProduct", err);
			return { ok: false, reason: "notfound" };
		}
	});

/** Up to four products side by side, for `<bd-compare>`. */
export const getComparePage = createServerFn({
	method: "GET",
	strict: SDK_OUTPUT,
})
	.validator((data: { ids: string[] }) => data)
	.handler(
		async ({ data }): Promise<{ ids: string[]; columns: CompareColumn[] }> => {
			const ids = data.ids.slice(0, 4);
			const bd = getBd();
			if (!bd) return { ids, columns: [] };
			const columns = await Promise.all(
				ids.map(async (id): Promise<CompareColumn | null> => {
					try {
						const [product, reviews] = await Promise.all([
							bd.storefront.getProduct(id),
							bd.storefront
								.getProductReviews(id, { limit: 1 })
								.catch(() => null),
						]);
						return {
							product,
							rating:
								reviews && reviews.totalCount > 0
									? { avg: reviews.avgRating, count: reviews.totalCount }
									: null,
						};
					} catch {
						return null;
					}
				}),
			);
			return {
				ids,
				columns: columns.filter(
					(column): column is CompareColumn => column !== null,
				),
			};
		},
	);

/** The cart's item count, for the store bar. */
export const getCartCount = createServerFn({ method: "GET" }).handler(
	async (): Promise<number> => (await getCart())?.itemCount ?? 0,
);

export type OrderStatus = { status: string | null; email: string | null };

/** The Stripe checkout session's state, for the page Stripe returns to. */
export const getOrderStatus = createServerFn({ method: "GET" })
	.validator((data: { sessionId: string | null }) => data)
	.handler(async ({ data }): Promise<OrderStatus> => {
		const bd = getBd();
		if (!bd || !data.sessionId) return { status: null, email: null };
		try {
			const res = await bd.checkout.getStatus(data.sessionId);
			return { status: res.paymentStatus, email: res.customerEmail };
		} catch (err) {
			devwarn("checkout.getStatus", err);
			return { status: null, email: null };
		}
	});

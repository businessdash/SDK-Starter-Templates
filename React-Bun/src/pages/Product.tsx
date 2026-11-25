// [bd-file:store]
import type {
	StorefrontProductDetail,
	StorefrontProductReviewsResponse,
} from "@businessdash/sdk/contracts";

import { announceCartCount, StoreNav } from "../components/StoreNav";
import { type AddToCartInput, type AddToCartResult, ProductDetail } from "../components/shop/ProductDetail";
import { bd } from "../lib/bd";
import { Link, useRoute, useSearchParams } from "../lib/router";
import { useApi } from "./ui";

/** Reviews shown at first; "Show more reviews" adds this many each time. */
const REVIEWS_PAGE = 10;

async function addToCart(input: AddToCartInput): Promise<AddToCartResult> {
	try {
		const snapshot = await bd.cart.add(input);
		return { ok: true, itemCount: Number(snapshot?.itemCount) || 0 };
	} catch {
		return { ok: false, error: "Couldn't add that to your cart. Try again." };
	}
}

/**
 * One product: the shared `ProductDetail` (photos, options, price, add to
 * cart, save, compare, share, details, add-ons, reviews, related and
 * recently viewed). Reviews grow with ?reviews=N, so "Show more reviews" is
 * a plain link.
 */
export function Product() {
	const { path } = useRoute();
	const params = useSearchParams();
	const id = decodeURIComponent(path.split("/")[2] ?? "");
	const shown = Number.parseInt(params.get("reviews") ?? "", 10);
	const reviewLimit = Number.isFinite(shown) ? Math.min(Math.max(shown, REVIEWS_PAGE), 100) : REVIEWS_PAGE;

	const { data, error } = useApi(() => bd.storefront.getProduct(id), [id]);
	// Companion surfaces: each is independent, and empty when it fails.
	const { data: reviews } = useApi(
		() => bd.storefront.getProductReviews(id, { limit: reviewLimit }).catch(() => null),
		[id, reviewLimit],
	);
	const { data: related } = useApi(() => bd.storefront.getRelatedProducts(id, { limit: 6 }).catch(() => null), [id]);
	const { data: addons } = useApi(() => bd.storefront.getProductAddons(id).catch(() => null), [id]);

	// Until this id's product arrives, the previous one stays out of view.
	const product = data && String(data.id) === id ? (data as StorefrontProductDetail) : null;
	const reviewPage = reviews as StorefrontProductReviewsResponse | null;

	return (
		<>
			<StoreNav />
			<main className="bd-page">
				{product ? (
					<ProductDetail
						addToCart={addToCart}
						addons={addons?.items ?? []}
						cartHref="/cart"
						moreReviewsHref={
							reviewPage && reviewPage.totalCount > reviewPage.items.length
								? `/store/${encodeURIComponent(id)}?reviews=${reviewLimit + REVIEWS_PAGE}#reviews`
								: null
						}
						onCartCount={announceCartCount}
						product={product}
						related={related?.items ?? []}
						reviews={reviewPage}
					/>
				) : error ? (
					<div className="bd-empty">
						That product isn't here, or isn't on sale right now.
						<p>
							<Link className="bd-btn" to="/store">
								Back to the store
							</Link>
						</p>
					</div>
				) : (
					<p className="bd-loading">Loading product…</p>
				)}
			</main>
		</>
	);
}

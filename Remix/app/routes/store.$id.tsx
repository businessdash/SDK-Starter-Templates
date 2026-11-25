// [bd-file:store]
import { data, Link, useLoaderData } from "react-router";
import type {
	LinksFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import shopStyles from "~/bd-shop.css?url";
import { SiteHeader } from "~/components/SiteHeader";
import { announceCartCount, StoreNav } from "~/components/StoreNav";
import { ProductDetail } from "~/components/shop/ProductDetail";
import {
	getCartSnapshot,
	getStoreProduct,
	getStoreProductAddons,
	getStoreProductReviews,
	getStoreRelatedProducts,
} from "~/lib/bd-store.server";
import { addToCartClient } from "~/lib/shop-client";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: shopStyles },
];

export const meta: MetaFunction<typeof loader> = ({ data }) => [
	{ title: data?.product ? `${data.product.name} — Store` : "Product" },
];

/** Reviews shown at first; "Show more reviews" adds this many each time. */
const REVIEWS_PAGE = 10;

/**
 * One product: the shared `ProductDetail` (photos, options, price, add to
 * cart, save, compare, share, details, add-ons, reviews, related and
 * recently viewed). Reviews grow with ?reviews=N, so "Show more reviews" is
 * a plain link.
 */
export async function loader({ params, request }: LoaderFunctionArgs) {
	const id = params["id"] ?? "";
	const shown = Number.parseInt(
		new URL(request.url).searchParams.get("reviews") ?? "",
		10,
	);
	const reviewLimit = Number.isFinite(shown)
		? Math.min(Math.max(shown, REVIEWS_PAGE), 100)
		: REVIEWS_PAGE;

	const [product, reviews, related, addons, cart] = await Promise.all([
		getStoreProduct(id),
		getStoreProductReviews(id, { limit: reviewLimit }),
		getStoreRelatedProducts(id),
		getStoreProductAddons(id),
		getCartSnapshot(request),
	]);
	const cartCount = cart?.itemCount ?? 0;
	if (!product) {
		return data({ product: null, cartCount } as const, { status: 404 });
	}
	return {
		product,
		reviews,
		addons: addons?.items ?? [],
		related: related ?? [],
		moreReviewsHref:
			reviews && reviews.totalCount > reviews.items.length
				? `/store/${id}?reviews=${reviewLimit + REVIEWS_PAGE}#reviews`
				: null,
		cartCount,
	};
}

export default function ProductPage() {
	const page = useLoaderData<typeof loader>();
	return (
		<>
			<SiteHeader />
			<StoreNav cartCount={page.cartCount} />
			<main className="bd-page">
				{page.product ? (
					<ProductDetail
						addToCart={addToCartClient}
						addons={page.addons}
						cartHref="/store/cart"
						moreReviewsHref={page.moreReviewsHref}
						onCartCount={announceCartCount}
						product={page.product}
						related={page.related}
						reviews={page.reviews}
					/>
				) : (
					<div className="bd-empty">
						That product isn't here, or isn't on sale right now.
						<p>
							<Link className="bd-btn" to="/store">
								Back to the store
							</Link>
						</p>
					</div>
				)}
			</main>
		</>
	);
}

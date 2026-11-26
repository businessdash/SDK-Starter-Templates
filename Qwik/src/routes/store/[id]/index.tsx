// [bd-file:store]
import { component$ } from "@builder.io/qwik";
import { type DocumentHead, Link, routeLoader$ } from "@builder.io/qwik-city";

import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";

import { Footer } from "../../../components/bd/Footer";
import { SiteHeader } from "../../../components/bd/SiteHeader";
import { StoreNav } from "../../../components/bd/StoreNav";
import { ProductDetail } from "../../../components/bd/shop/ProductDetail";
import { getBd } from "../../../lib/bd";
import { getCustomerSession } from "../../../lib/bd-portal";
import {
	getCartSnapshot,
	getStoreProductAddons,
	getStoreProductReviews,
	getStoreRelatedProducts,
} from "../../../lib/bd-store";
import type { ProductPageData } from "../../../lib/shop/shop";

/** Reviews shown at first; each "Show more" adds this many (?reviews=20). */
const REVIEWS_PAGE = 10;

/**
 * One product. The loader reads the product, its reviews, add-ons and
 * related products on the server, and `<ProductDetail>` lays the page out
 * from the shop's parts (src/components/bd/shop/): option photos, option and
 * size buttons, the price for what's chosen, add to cart (POST
 * /api/bd/cart/add), save, compare, share, add-ons, reviews, related and
 * recently viewed.
 */
export const useProduct = routeLoader$(
	async ({ params, cookie, query, status }) => {
		const bd = getBd();
		const [cart, session] = await Promise.all([
			getCartSnapshot(cookie),
			getCustomerSession(cookie),
		]);
		const base = {
			configured: bd !== null,
			suspended: false,
			data: null as ProductPageData | null,
			cartCount: cart?.itemCount ?? 0,
			signedIn: !!session,
		};
		if (!bd) return base;

		const asked = Number.parseInt(query.get("reviews") ?? "", 10);
		const reviewLimit = Math.min(
			100,
			Number.isFinite(asked) && asked > REVIEWS_PAGE ? asked : REVIEWS_PAGE,
		);
		try {
			const [product, reviews, addons, related] = await Promise.all([
				bd.storefront.getProduct(params.id),
				getStoreProductReviews(params.id, { limit: reviewLimit }),
				getStoreProductAddons(params.id),
				getStoreRelatedProducts(params.id, { limit: 6 }),
			]);
			const data: ProductPageData = {
				product,
				reviews,
				addons: addons?.items ?? [],
				related: related?.items ?? [],
				moreReviewsHref:
					reviews && reviews.totalCount > reviews.items.length
						? `/store/${encodeURIComponent(params.id)}?reviews=${reviewLimit + REVIEWS_PAGE}#reviews`
						: null,
			};
			return { ...base, data };
		} catch (err) {
			if (
				err instanceof BdServiceSuspendedError ||
				err instanceof BdPaymentLapsedError
			) {
				return { ...base, suspended: true };
			}
			status(404);
			return base;
		}
	},
);

export default component$(() => {
	const loaded = useProduct();
	const { data, configured, suspended } = loaded.value;

	return (
		<>
			<SiteHeader signedIn={loaded.value.signedIn} />
			<StoreNav cartCount={loaded.value.cartCount} />
			<main class="bd-page">
				{suspended ? (
					<div class="bd-empty">
						The store is temporarily unavailable. Please check back soon.
					</div>
				) : !configured ? (
					<div class="bd-empty">
						Store isn't connected yet. Set the BD env vars (see{" "}
						<code>.env.example</code>) to go live.
					</div>
				) : !data ? (
					<div class="bd-empty">
						That product isn't available.{" "}
						<Link href="/store">Browse the store</Link>
					</div>
				) : (
					<ProductDetail cartHref="/cart" contactHref="/#contact" data={data} />
				)}
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = ({ resolveValue }) => {
	const { data } = resolveValue(useProduct);
	const name = data?.product.name ?? "Product";
	const description =
		typeof data?.product.description === "string" && data.product.description
			? data.product.description
			: `${name}: choose options and add it to your cart.`;
	return {
		title: `${name} — Your Business`,
		meta: [{ name: "description", content: description }],
	};
};

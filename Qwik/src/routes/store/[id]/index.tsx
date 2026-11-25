// [bd-file:store]
import { component$ } from "@builder.io/qwik";
import { type DocumentHead, Link, routeLoader$ } from "@builder.io/qwik-city";

import { BdPaymentLapsedError, BdServiceSuspendedError } from "@businessdash/sdk";

import { Footer } from "../../../components/bd/Footer";
import { SiteHeader } from "../../../components/bd/SiteHeader";
import { StoreNav } from "../../../components/bd/StoreNav";
import { getBd } from "../../../lib/bd";
import { elementHtml, escapeHtml } from "../../../lib/bd-elements";
import { getCustomerSession } from "../../../lib/bd-portal";
import {
	getCartSnapshot,
	getStoreProductAddons,
	getStoreProductReviews,
	getStoreRelatedProducts,
} from "../../../lib/bd-store";
import type { ProductPageData } from "../../../lib/shop/shop-elements";

/** Reviews shown at first; each "Show more" adds this many (?reviews=20). */
const REVIEWS_PAGE = 10;

/**
 * One product. The loader reads the product, its reviews, add-ons and
 * related products on the server, and `<bd-product>` (src/lib/shop/) draws
 * the page from that data: option photos, option and size buttons, the price
 * for what's chosen, add to cart (POST /api/bd/cart/add), save, compare,
 * share, add-ons, reviews, related and recently viewed.
 */
export const useProduct = routeLoader$(async ({ params, cookie, query, status }) => {
	const bd = getBd();
	const [cart, session] = await Promise.all([getCartSnapshot(cookie), getCustomerSession(cookie)]);
	const base = {
		configured: bd !== null,
		suspended: false,
		data: null as ProductPageData | null,
		cartCount: cart?.itemCount ?? 0,
		signedIn: !!session,
	};
	if (!bd) return base;

	const asked = Number.parseInt(query.get("reviews") ?? "", 10);
	const reviewLimit = Math.min(100, Number.isFinite(asked) && asked > REVIEWS_PAGE ? asked : REVIEWS_PAGE);
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
		if (err instanceof BdServiceSuspendedError || err instanceof BdPaymentLapsedError) {
			return { ...base, suspended: true };
		}
		status(404);
		return base;
	}
});

export default component$(() => {
	const loaded = useProduct();
	const { data, configured, suspended } = loaded.value;
	const description =
		typeof data?.product.description === "string" ? data.product.description : null;

	return (
		<>
			<SiteHeader signedIn={loaded.value.signedIn} />
			<StoreNav cartCount={loaded.value.cartCount} />
			<main class="bd-page">
				{suspended ? (
					<div class="bd-empty">The store is temporarily unavailable. Please check back soon.</div>
				) : !configured ? (
					<div class="bd-empty">
						Store isn't connected yet. Set the BD env vars (see <code>.env.example</code>) to go live.
					</div>
				) : !data ? (
					<div class="bd-empty">
						That product isn't available. <Link href="/store">Browse the store</Link>
					</div>
				) : (
					<div
						dangerouslySetInnerHTML={elementHtml(
							"bd-product",
							{
								"data-add-url": "/api/bd/cart/add",
								"data-cart-href": "/cart",
								"data-contact-href": "/#contact",
							},
							data,
							// Shown without JavaScript; the element replaces it when it draws.
							`<noscript><h1>${escapeHtml(data.product.name)}</h1>${
								description ? `<p>${escapeHtml(description)}</p>` : ""
							}<p>Turn on JavaScript to choose options and add this to your cart.</p></noscript>`,
						)}
					/>
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

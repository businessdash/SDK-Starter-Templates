// [bd-file:store]
/**
 * /store/:id — one product: photos that follow the chosen option, option and
 * size buttons, the price for what's chosen, add to cart, save and compare,
 * share, details, add-ons, reviews, related products and what was viewed
 * before. This module loads the data; `<bd-product>` from
 * /shop/shop-elements.js draws the page and posts to /api/bd/cart/add.
 * More reviews: ?reviews=20.
 */
import "/shop/shop-elements.js";
import { bd, el } from "/bd.js";
import { errBox } from "./_ui.js";
import { mountStoreNav } from "./_store-nav.js";

/** Reviews shown at first, and how many more each "Show more" adds. */
const REVIEWS_PAGE = 10;

export default async function render(root) {
	mountStoreNav();
	const id = decodeURIComponent(location.pathname.split("/").pop() ?? "");
	const raw = Number.parseInt(new URLSearchParams(location.search).get("reviews") ?? "", 10);
	const reviewLimit = Math.min(100, Number.isFinite(raw) && raw > REVIEWS_PAGE ? raw : REVIEWS_PAGE);

	let product;
	try {
		product = await bd.storefront.getProduct(id);
	} catch (err) {
		root.replaceChildren(
			/\b404\b/.test(String(err?.message))
				? el("div", { class: "bd-empty" }, [
						"That product isn't available. ",
						el("a", { href: "/store" }, ["Browse the store"]),
					])
				: errBox(err),
		);
		return;
	}
	const [reviews, addons, related] = await Promise.all([
		bd.storefront.getProductReviews(id, { limit: reviewLimit }).catch(() => null),
		bd.storefront.getProductAddons(id).catch(() => null),
		bd.storefront.getRelatedProducts(id, { limit: 6 }).catch(() => null),
	]);
	document.title = `${product.name} — Store`;

	const data = {
		product,
		reviews,
		addons: addons?.items ?? [],
		related: related?.items ?? [],
		moreReviewsHref:
			reviews && reviews.totalCount > reviews.items.length
				? `/store/${encodeURIComponent(id)}?reviews=${reviewLimit + REVIEWS_PAGE}#reviews`
				: null,
	};
	const page = el("bd-product", {
		"data-add-url": "/api/bd/cart/add",
		"data-cart-href": "/cart",
		"data-contact-href": "/#contact",
	});
	page.append(el("script", { type: "application/json" }, [JSON.stringify(data)]));
	root.replaceChildren(page);
	if (location.hash) document.getElementById(location.hash.slice(1))?.scrollIntoView();
}

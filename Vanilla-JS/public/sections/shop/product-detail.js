// [bd-file:store]
import { el } from "/bd.js";
import {
	allOptionGroups,
	defaultVariant,
	optionGroupsFor,
	photoSets,
	priceFor,
	productSummary,
	toProductView,
} from "/shop/shop.js";
import { addToCartButton } from "./add-to-cart-button.js";
import { cartNotice } from "./cart-notice.js";
import { compareBar } from "./compare-bar.js";
import { optionPicker } from "./option-picker.js";
import { productAddons } from "./product-addons.js";
import { productBreadcrumbs } from "./product-breadcrumbs.js";
import { productGallery } from "./product-gallery.js";
import { productPolicies } from "./product-policies.js";
import { productPrice } from "./product-price.js";
import { productRail } from "./product-rail.js";
import { productReviews } from "./product-reviews.js";
import { productSpecs } from "./product-specs.js";
import { productTitle } from "./product-title.js";
import { quantityStepper } from "./quantity-stepper.js";
import { recentlyViewed } from "./recently-viewed.js";
import { saveButtons } from "./save-buttons.js";
import { shareButton } from "./share-button.js";
import { stockNote } from "./stock-note.js";
import { variantPicker } from "./variant-picker.js";

/**
 * The whole product page: photos that follow the chosen option, option and
 * size buttons, the price for what's chosen, add to cart, save and compare,
 * share, details, add-ons, reviews, related products and what was viewed
 * before.
 *
 * It's laid out from the parts imported above, one file each, drawn as the
 * page opens (the first variant that can be bought, nothing else chosen).
 * `<bd-gallery>` and `<bd-product-form>` (/shop/shop-elements.js) bring them
 * to life: they find the parts by their data-bd attributes, so move,
 * restyle or drop any part, or lay them out your own way.
 *
 * `data` is { product, reviews, addons, related, moreReviewsHref }; this
 * returns the page's nodes, to append where it goes.
 */
export function productDetail(
	data,
	{ storeHref = "/store", cartHref = "/store/cart", addUrl = "/api/bd/cart/add", contactHref = "/#contact" } = {},
) {
	const { product, reviews, addons, related, moreReviewsHref } = data;
	const view = toProductView(product);
	const variantId = defaultVariant(view)?.id ?? "";
	const price = priceFor(view, variantId, {});
	const summary = productSummary(view, variantId, {});
	const relatedCards = related.map((rp) => ({
		id: rp.id,
		name: rp.name,
		image: rp.coverImageUrl,
		priceCents: rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
	}));

	const page = document.createDocumentFragment();
	const parts = [
		productBreadcrumbs(view, { storeHref }),
		el("div", { class: "product-detail" }, [
			productGallery({ productId: view.id, name: view.name, sets: photoSets(view), variantId }),
			el("div", { class: "product-detail__info bd-card" }, [
				productTitle(view, reviews),
				el("bd-product-form", { "data-add-url": addUrl, "data-cart-href": cartHref }, [
					el("script", { type: "application/json" }, [JSON.stringify({ product })]),
					productPrice(price),
					view.description ? el("p", { class: "product-detail__desc" }, [view.description]) : null,
					variantPicker({
						variants: view.variants,
						selected: variantId,
						showPrices: optionGroupsFor(view, variantId).length === 0,
					}),
					...allOptionGroups(view).map((group) =>
						optionPicker(group, { hidden: group.variantId !== null && group.variantId !== variantId }),
					),
					stockNote(price.stock),
					el("div", { class: "buy" }, [quantityStepper({ max: price.stock }), addToCartButton(price)]),
					cartNotice(cartHref),
					el("div", { class: "product-detail__tools" }, [saveButtons(summary), shareButton(view.name)]),
					productPolicies({ contactHref }),
				]),
			]),
		]),
		productSpecs(view),
		productAddons(addons, { addUrl }),
		productReviews(reviews, { moreHref: moreReviewsHref }),
		productRail("You may also like", relatedCards, { storeHref }),
		recentlyViewed(summary, { storeHref }),
		compareBar({ storeHref }),
	];
	for (const part of parts) if (part) page.append(part);
	return page;
}

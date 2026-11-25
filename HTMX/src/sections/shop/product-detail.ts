// [bd-file:store]
import { html, jsonScript, type Raw } from "../../html";
import {
	allOptionGroups,
	defaultVariant,
	optionGroupsFor,
	type ProductPageData,
	photoSets,
	priceFor,
	productSummary,
	type SavedProduct,
	toProductView,
} from "../../shop/shop";
import { addToCartButton } from "./add-to-cart-button";
import { cartNotice } from "./cart-notice";
import { compareBar } from "./compare-bar";
import { optionPicker } from "./option-picker";
import { productAddons } from "./product-addons";
import { productBreadcrumbs } from "./product-breadcrumbs";
import { productGallery } from "./product-gallery";
import { productPolicies } from "./product-policies";
import { productPrice } from "./product-price";
import { productRail } from "./product-rail";
import { productReviews } from "./product-reviews";
import { productSpecs } from "./product-specs";
import { productTitle } from "./product-title";
import { quantityStepper } from "./quantity-stepper";
import { recentlyViewed } from "./recently-viewed";
import { saveButtons } from "./save-buttons";
import { shareButton } from "./share-button";
import { stockNote } from "./stock-note";
import { variantPicker } from "./variant-picker";

/**
 * The whole product page: photos that follow the chosen option, option and
 * size buttons, the price for what's chosen, add to cart, save and compare,
 * share, details, add-ons, reviews, related products and what was viewed
 * before.
 *
 * It's laid out from the parts imported above, one file each, drawn here on
 * the server as the page opens (the first variant that can be bought,
 * nothing else chosen). `<bd-gallery>` and `<bd-product-form>`
 * (src/shop/shop-elements.ts) bring them to life in the browser: they find
 * the parts by their data-bd attributes, so move, restyle or drop any part,
 * or lay them out your own way.
 */
export function productDetail(
	data: ProductPageData,
	{ storeHref = "/store", cartHref = "/store/cart", addUrl = "/api/bd/cart/add", contactHref = "/#contact" } = {},
): Raw {
	const { product, reviews, addons, related, moreReviewsHref } = data;
	const view = toProductView(product);
	const variantId = defaultVariant(view)?.id ?? "";
	const price = priceFor(view, variantId, {});
	const summary = productSummary(view, variantId, {});
	const relatedCards: SavedProduct[] = related.map((rp) => ({
		id: rp.id,
		name: rp.name,
		image: rp.coverImageUrl,
		priceCents: rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
	}));

	return html`${productBreadcrumbs(view, { storeHref })}
		<div class="product-detail">
			${productGallery({ productId: view.id, name: view.name, sets: photoSets(view), variantId })}
			<div class="product-detail__info bd-card">
				${productTitle(view, reviews)}
				<bd-product-form data-add-url="${addUrl}" data-cart-href="${cartHref}">
					${jsonScript({ product })}
					${productPrice(price)}
					${view.description ? html`<p class="product-detail__desc">${view.description}</p>` : ""}
					${variantPicker({
						variants: view.variants,
						selected: variantId,
						showPrices: optionGroupsFor(view, variantId).length === 0,
					})}
					${allOptionGroups(view).map((group) =>
						optionPicker(group, { hidden: group.variantId !== null && group.variantId !== variantId }),
					)}
					${stockNote(price.stock)}
					<div class="buy">${quantityStepper({ max: price.stock })}${addToCartButton(price)}</div>
					${cartNotice(cartHref)}
					<div class="product-detail__tools">${saveButtons(summary)}${shareButton(view.name)}</div>
					${productPolicies({ contactHref })}
				</bd-product-form>
			</div>
		</div>
		${productSpecs(view)}
		${productAddons(addons, { addUrl })}
		${productReviews(reviews, { moreHref: moreReviewsHref })}
		${productRail("You may also like", relatedCards, { storeHref })}
		${recentlyViewed(summary, { storeHref })}
		${compareBar({ storeHref })}`;
}

// [bd-file:store]
import { Fragment } from "@builder.io/qwik";

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
} from "../../../lib/shop/shop";
import { AddToCartButton } from "./AddToCartButton";
import { CartNotice } from "./CartNotice";
import { CompareBar } from "./CompareBar";
import { OptionPicker } from "./OptionPicker";
import { ProductAddons } from "./ProductAddons";
import { ProductBreadcrumbs } from "./ProductBreadcrumbs";
import { ProductGallery } from "./ProductGallery";
import { ProductPolicies } from "./ProductPolicies";
import { ProductPrice } from "./ProductPrice";
import { ProductRail } from "./ProductRail";
import { ProductReviews } from "./ProductReviews";
import { ProductSpecs } from "./ProductSpecs";
import { ProductTitle } from "./ProductTitle";
import { QuantityStepper } from "./QuantityStepper";
import { RecentlyViewed } from "./RecentlyViewed";
import { SaveButtons } from "./SaveButtons";
import { ShareButton } from "./ShareButton";
import { StockNote } from "./StockNote";
import { VariantPicker } from "./VariantPicker";

/**
 * The whole product page: photos that follow the chosen option, option and
 * size buttons, the price for what's chosen, add to cart, save and compare,
 * share, details, add-ons, reviews, related products and what was viewed
 * before.
 *
 * It's laid out from the parts imported above, one file each, drawn as the
 * page opens (the first variant that can be bought, nothing else chosen).
 * `<bd-gallery>` and `<bd-product-form>` (src/lib/shop/shop-elements.ts)
 * bring them to life: they find the parts by their data-bd attributes, so
 * move, restyle or drop any part, or lay them out your own way.
 *
 * The parts are plain functions, drawn on the server; the page is keyed on
 * the product, so opening another product draws it afresh rather than
 * patching markup the elements have changed.
 */
export function ProductDetail({
	data,
	storeHref = "/store",
	cartHref = `${storeHref}/cart`,
	addUrl = "/api/bd/cart/add",
	contactHref = "/#contact",
}: {
	data: ProductPageData;
	storeHref?: string;
	cartHref?: string;
	addUrl?: string;
	contactHref?: string;
}) {
	const { product, reviews, addons, related, moreReviewsHref } = data;
	const view = toProductView(product);
	const variantId = defaultVariant(view)?.id ?? "";
	const price = priceFor(view, variantId, {});
	const summary = productSummary(view, variantId, {});
	const relatedCards: SavedProduct[] = related.map((rp) => ({
		id: rp.id,
		name: rp.name,
		image: rp.coverImageUrl,
		priceCents:
			rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
	}));

	return (
		<Fragment key={view.id}>
			<ProductBreadcrumbs product={view} storeHref={storeHref} />

			<div class="product-detail">
				<ProductGallery
					name={view.name}
					productId={view.id}
					sets={photoSets(view)}
					variantId={variantId}
				/>

				<div class="product-detail__info bd-card">
					<ProductTitle product={view} reviews={reviews} />
					<bd-product-form data-add-url={addUrl} data-cart-href={cartHref}>
						<script
							dangerouslySetInnerHTML={JSON.stringify({ product }).replace(
								/</g,
								"\\u003c",
							)}
							type="application/json"
						/>
						<ProductPrice price={price} />
						{view.description ? (
							<p class="product-detail__desc">{view.description}</p>
						) : null}
						<VariantPicker
							selected={variantId}
							showPrices={optionGroupsFor(view, variantId).length === 0}
							variants={view.variants}
						/>
						{allOptionGroups(view).map((group) => (
							<OptionPicker
								group={group}
								hidden={
									group.variantId !== null && group.variantId !== variantId
								}
								key={`${group.variantId ?? ""}:${group.id}`}
							/>
						))}
						<StockNote stock={price.stock} />

						<div class="buy">
							<QuantityStepper max={price.stock} />
							<AddToCartButton price={price} />
						</div>
						<CartNotice cartHref={cartHref} />

						<div class="product-detail__tools">
							<SaveButtons product={summary} />
							<ShareButton title={view.name} />
						</div>
						<ProductPolicies contactHref={contactHref} />
					</bd-product-form>
				</div>
			</div>

			<ProductSpecs features={view.features} specs={view.specs} />
			<ProductAddons addUrl={addUrl} addons={addons} />
			<ProductReviews moreHref={moreReviewsHref} reviews={reviews} />
			<ProductRail
				products={relatedCards}
				storeHref={storeHref}
				title="You may also like"
			/>
			<RecentlyViewed product={summary} storeHref={storeHref} />
			<CompareBar storeHref={storeHref} />
		</Fragment>
	);
}

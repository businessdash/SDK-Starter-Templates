// [bd-file:store]
import { For, Show } from "solid-js";

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
 */
export function ProductDetail(props: {
	data: ProductPageData;
	storeHref?: string;
	cartHref?: string;
	addUrl?: string;
	contactHref?: string;
}) {
	// The page is drawn once per product (the route keys it), so these are plain values.
	const { product, reviews, addons, related, moreReviewsHref } = props.data;
	const view = toProductView(product);
	const variantId = defaultVariant(view)?.id ?? "";
	const price = priceFor(view, variantId, {});
	const summary = productSummary(view, variantId, {});
	const store = props.storeHref ?? "/store";
	const relatedCards: SavedProduct[] = related.map((rp) => ({
		id: rp.id,
		name: rp.name,
		image: rp.coverImageUrl,
		priceCents:
			rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
	}));

	return (
		<>
			<ProductBreadcrumbs product={view} storeHref={store} />

			<div class="product-detail">
				<ProductGallery
					name={view.name}
					productId={view.id}
					sets={photoSets(view)}
					variantId={variantId}
				/>

				<div class="product-detail__info bd-card">
					<ProductTitle product={view} reviews={reviews} />
					<bd-product-form
						data-add-url={props.addUrl ?? "/api/bd/cart/add"}
						data-cart-href={props.cartHref ?? `${store}/cart`}
					>
						<script
							innerHTML={JSON.stringify({ product }).replace(/</g, "\\u003c")}
							type="application/json"
						/>
						<ProductPrice price={price} />
						<Show when={view.description}>
							<p class="product-detail__desc">{view.description}</p>
						</Show>
						<VariantPicker
							selected={variantId}
							showPrices={optionGroupsFor(view, variantId).length === 0}
							variants={view.variants}
						/>
						<For each={allOptionGroups(view)}>
							{(group) => (
								<OptionPicker
									group={group}
									hidden={group.variantId !== null && group.variantId !== variantId}
								/>
							)}
						</For>
						<StockNote stock={price.stock} />

						<div class="buy">
							<QuantityStepper max={price.stock} />
							<AddToCartButton price={price} />
						</div>
						<CartNotice cartHref={props.cartHref ?? `${store}/cart`} />

						<div class="product-detail__tools">
							<SaveButtons product={summary} />
							<ShareButton title={view.name} />
						</div>
						<ProductPolicies contactHref={props.contactHref} />
					</bd-product-form>
				</div>
			</div>

			<ProductSpecs features={view.features} specs={view.specs} />
			<ProductAddons addUrl={props.addUrl} addons={addons} />
			<ProductReviews moreHref={moreReviewsHref} reviews={reviews} />
			<ProductRail
				products={relatedCards}
				storeHref={store}
				title="You may also like"
			/>
			<RecentlyViewed product={summary} storeHref={store} />
			<CompareBar storeHref={store} />
		</>
	);
}

// [bd-file:store]
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, computed, input } from "@angular/core";
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
import { AddToCartButtonComponent } from "./add-to-cart-button.component";
import { CartNoticeComponent } from "./cart-notice.component";
import { OptionPickerComponent } from "./option-picker.component";
import { ProductAddonsComponent } from "./product-addons.component";
import { ProductBreadcrumbsComponent } from "./product-breadcrumbs.component";
import { ProductGalleryComponent } from "./product-gallery.component";
import { ProductPoliciesComponent } from "./product-policies.component";
import { ProductPriceComponent } from "./product-price.component";
import { ProductRailComponent } from "./product-rail.component";
import { ProductReviewsComponent } from "./product-reviews.component";
import { ProductSpecsComponent } from "./product-specs.component";
import { ProductTitleComponent } from "./product-title.component";
import { QuantityStepperComponent } from "./quantity-stepper.component";
import { RecentlyViewedDirective } from "./recently-viewed.directive";
import { SaveButtonsDirective } from "./save-buttons.directive";
import { ShareButtonComponent } from "./share-button.component";
import { StockNoteComponent } from "./stock-note.component";
import { VariantPickerComponent } from "./variant-picker.component";

/**
 * The whole product page: photos that follow the chosen option, option and
 * size buttons, the price for what's chosen, add to cart, save and compare,
 * share, details, add-ons, reviews, related products and what was viewed
 * before.
 *
 * It's laid out from the parts imported above, one file each, drawn as the
 * page opens (the first variant that can be bought, nothing else chosen).
 * `<bd-gallery>` and `<bd-product-form>` (src/app/shop/shop-elements.ts)
 * bring them to life: they find the parts by their data-bd attributes, so
 * move, restyle or drop any part, or lay them out your own way. Draw one
 * per product (the product page tracks it by id), so another product starts
 * afresh.
 */
@Component({
	selector: "bd-product-detail",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [
		AddToCartButtonComponent,
		CartNoticeComponent,
		OptionPickerComponent,
		ProductAddonsComponent,
		ProductBreadcrumbsComponent,
		ProductGalleryComponent,
		ProductPoliciesComponent,
		ProductPriceComponent,
		ProductRailComponent,
		ProductReviewsComponent,
		ProductSpecsComponent,
		ProductTitleComponent,
		QuantityStepperComponent,
		RecentlyViewedDirective,
		SaveButtonsDirective,
		ShareButtonComponent,
		StockNoteComponent,
		VariantPickerComponent,
	],
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: ":host { display: contents; }",
	template: `
		<bd-product-breadcrumbs [product]="view()" [storeHref]="storeHref()" />

		<div class="product-detail">
			<bd-product-gallery
				[name]="view().name"
				[productId]="view().id"
				[sets]="photoSets()"
				[variantId]="variantId()"
			/>

			<div class="product-detail__info bd-card">
				<bd-product-title [product]="view()" [reviews]="data().reviews" />
				<bd-product-form
					[attr.data-add-url]="addUrl()"
					[attr.data-cart-href]="cartHref()"
					[product]="data().product"
				>
					<bd-product-price [price]="price()" />
					@if (view().description) {
						<p class="product-detail__desc">{{ view().description }}</p>
					}
					<bd-variant-picker
						[selected]="variantId()"
						[showPrices]="showVariantPrices()"
						[variants]="view().variants"
					/>
					@for (group of groups(); track (group.variantId ?? "") + ":" + group.id) {
						<bd-option-picker
							[group]="group"
							[hidden]="group.variantId !== null && group.variantId !== variantId()"
						/>
					}
					<bd-stock-note [stock]="price().stock" />

					<div class="buy">
						<bd-quantity-stepper [max]="price().stock" />
						<bd-add-to-cart-button [price]="price()" />
					</div>
					<bd-cart-notice [cartHref]="cartHref()" />

					<div class="product-detail__tools">
						<bd-save-buttons [product]="summary()" />
						<bd-share-button [title]="view().name" />
					</div>
					<bd-product-policies [contactHref]="contactHref()" />
				</bd-product-form>
			</div>
		</div>

		<bd-product-specs [features]="view().features" [specs]="view().specs" />
		<bd-product-addons [addUrl]="addUrl()" [addons]="data().addons" />
		<bd-product-reviews [moreHref]="data().moreReviewsHref" [reviews]="data().reviews" />
		<bd-product-rail [products]="related()" [storeHref]="storeHref()" title="You may also like" />
		<bd-recently-viewed [attr.data-store-href]="storeHref()" [product]="summary()" />
		<bd-compare-bar [attr.data-store-href]="storeHref()" />
	`,
})
export class ProductDetailComponent {
	readonly data = input.required<ProductPageData>();
	readonly storeHref = input("/store");
	readonly cartHref = input("/store/cart");
	readonly addUrl = input("/api/bd/cart/add");
	readonly contactHref = input("/#contact");

	readonly view = computed(() => toProductView(this.data().product));
	readonly variantId = computed(() => defaultVariant(this.view())?.id ?? "");
	readonly price = computed(() => priceFor(this.view(), this.variantId(), {}));
	readonly summary = computed(() => productSummary(this.view(), this.variantId(), {}));
	readonly photoSets = computed(() => photoSets(this.view()));
	readonly groups = computed(() => allOptionGroups(this.view()));
	readonly showVariantPrices = computed(() => optionGroupsFor(this.view(), this.variantId()).length === 0);
	readonly related = computed<SavedProduct[]>(() =>
		this.data().related.map((rp) => ({
			id: rp.id,
			name: rp.name,
			image: rp.coverImageUrl,
			priceCents: rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
		})),
	);
}

// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import { RouterLink } from "@angular/router";
import { formatCents, type SavedProduct } from "../../shop/shop";

/** A row of small product cards: related products. */
@Component({
	selector: "bd-product-rail",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [RouterLink],
	styles: ":host { display: contents; }",
	template: `
		@if (products().length > 0) {
			<section class="product-rail">
				<h2 class="product-rail__title">{{ title() }}</h2>
				<ul class="product-rail__row">
					@for (product of products(); track product.id) {
						<li>
							<a class="bd-card product-rail__card" [routerLink]="[storeHref(), product.id]">
								@if (product.image) {
									<img alt="" loading="lazy" referrerpolicy="no-referrer" [src]="product.image" />
								} @else {
									<span aria-hidden="true" class="product-rail__noimg"></span>
								}
								<span class="product-rail__name">{{ product.name }}</span>
								@if (product.priceCents != null) {
									<span class="product-rail__price">{{ money(product.priceCents) }}</span>
								}
							</a>
						</li>
					}
				</ul>
			</section>
		}
	`,
})
export class ProductRailComponent {
	readonly title = input.required<string>();
	readonly products = input.required<SavedProduct[]>();
	readonly storeHref = input("/store");
	readonly money = formatCents;
}

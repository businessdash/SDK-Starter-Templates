// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { ProductCard } from "../../lib/bd-api.client";
import { ProductCardComponent } from "./product-card.component";

/** The store's products, a <bd-product-card> each. */
@Component({
	selector: "bd-product-grid",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ProductCardComponent],
	styles: ":host { display: contents; }",
	template: `
		<div class="bd-grid-3">
			@for (p of products(); track p.id) {
				<bd-product-card [product]="p" [storeHref]="storeHref()" />
			}
		</div>
	`,
})
export class ProductGridComponent {
	readonly products = input.required<ProductCard[]>();
	readonly storeHref = input("/store");
}

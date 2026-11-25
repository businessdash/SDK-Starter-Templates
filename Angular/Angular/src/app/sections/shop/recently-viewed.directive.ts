// [bd-file:store]
import { computed, Directive, input } from "@angular/core";
import type { SavedProduct } from "../../shop/shop";

/**
 * What this browser opened before, as a rail; this product joins the list
 * for next time: `<bd-recently-viewed [product]="…" />`. The list lives in
 * this browser, so the element (src/app/shop/shop-elements.ts) draws the
 * rail; this gives it the product as its data-product.
 */
@Directive({
	selector: "bd-recently-viewed[product]",
	host: { "[attr.data-product]": "json()" },
})
export class RecentlyViewedDirective {
	readonly product = input.required<SavedProduct>();
	readonly json = computed(() => JSON.stringify(this.product()));
}

// [bd-file:store]
import { computed, Directive, input } from "@angular/core";
import type { SavedProduct } from "../../shop/shop";

/**
 * ♡ Save and ⇄ Compare: `<bd-save-buttons [product]="…" />`, with
 * `compact` for just the symbols. The lists live in this browser, so the
 * element (src/app/shop/shop-elements.ts) draws the buttons; this gives it
 * the product as its data-product.
 */
@Directive({
	selector: "bd-save-buttons[product]",
	host: { "[attr.data-product]": "json()" },
})
export class SaveButtonsDirective {
	readonly product = input.required<SavedProduct>();
	readonly json = computed(() => JSON.stringify(this.product()));
}

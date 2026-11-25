// [bd-file:store]
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, input } from "@angular/core";
import type { StorefrontAddonsResponse } from "@businessdash/sdk/contracts";
import { formatCents } from "../../shop/shop";

type Addon = StorefrontAddonsResponse["items"][number];

/** "Complete your purchase": add-ons, each added to the cart by `<bd-addon>`. */
@Component({
	selector: "bd-product-addons",
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: ":host { display: contents; }",
	template: `
		@if (addons().length > 0) {
			<section class="product-section">
				<h2 class="product-section__title">Complete your purchase</h2>
				<div class="addon-grid">
					@for (addon of addons(); track addon.id) {
						<div class="addon-card bd-card">
							<div class="addon-card__media">
								@if (addon.imageUrl) {
									<img loading="lazy" referrerpolicy="no-referrer" [alt]="addon.addonName" [src]="addon.imageUrl" />
								} @else {
									<div class="addon-card__noimg">—</div>
								}
							</div>
							<div class="addon-card__body">
								@if (addon.groupLabel) {
									<span class="addon-card__group">{{ addon.groupLabel }}</span>
								}
								<p class="addon-card__name">{{ addon.addonName }}</p>
								@if (addon.priceCents != null) {
									<span class="addon-card__price">{{ money(addon.priceCents) }}</span>
								}
							</div>
							<bd-addon
								[attr.data-add-url]="addUrl()"
								[attr.data-product-id]="addon.addonProductId"
								[attr.data-variant-id]="variantOf(addon)"
							>
								<button class="bd-btn bd-btn--ghost addon-card__add" data-bd-add type="button">Add</button>
							</bd-addon>
						</div>
					}
				</div>
			</section>
		}
	`,
})
export class ProductAddonsComponent {
	readonly addons = input.required<Addon[]>();
	readonly addUrl = input("/api/bd/cart/add");
	readonly money = formatCents;

	/** The variant an add-on is added as: its first. */
	variantOf(addon: Addon): string | null {
		const first = (Array.isArray(addon.variants) ? addon.variants[0] : undefined) as
			| { variantId?: unknown; id?: unknown }
			| undefined;
		const id = first?.variantId ?? first?.id;
		return typeof id === "string" ? id : null;
	}
}

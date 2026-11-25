// [bd-file:store]
import type { StorefrontAddonsResponse } from "@businessdash/sdk/contracts";

import { formatCents } from "../../../lib/shop/shop";

type Addon = StorefrontAddonsResponse["items"][number];

/** The variant an add-on is added as: its first. */
function addonVariant(addon: Addon): string | undefined {
	const first = (Array.isArray(addon.variants) ? addon.variants[0] : undefined) as
		| { variantId?: unknown; id?: unknown }
		| undefined;
	const id = first?.variantId ?? first?.id;
	return typeof id === "string" ? id : undefined;
}

/** "Complete your purchase": add-ons, each added to the cart by `<bd-addon>`. */
export function ProductAddons({ addons, addUrl = "/api/bd/cart/add" }: { addons: Addon[]; addUrl?: string }) {
	if (addons.length === 0) return null;
	return (
		<section class="product-section">
			<h2 class="product-section__title">Complete your purchase</h2>
			<div class="addon-grid">
				{addons.map((addon) => (
					<div class="addon-card bd-card" key={addon.id}>
						<div class="addon-card__media">
							{addon.imageUrl ? (
								<img alt={addon.addonName} loading="lazy" referrerPolicy="no-referrer" src={addon.imageUrl} />
							) : (
								<div class="addon-card__noimg">—</div>
							)}
						</div>
						<div class="addon-card__body">
							{addon.groupLabel ? <span class="addon-card__group">{addon.groupLabel}</span> : null}
							<p class="addon-card__name">{addon.addonName}</p>
							{addon.priceCents != null ? <span class="addon-card__price">{formatCents(addon.priceCents)}</span> : null}
						</div>
						<bd-addon data-add-url={addUrl} data-product-id={addon.addonProductId} data-variant-id={addonVariant(addon)}>
							<button class="bd-btn bd-btn--ghost addon-card__add" data-bd-add="" type="button">
								Add
							</button>
						</bd-addon>
					</div>
				))}
			</div>
		</section>
	);
}

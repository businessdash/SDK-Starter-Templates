// [bd-file:store]
import type { StorefrontAddonsResponse } from "@businessdash/sdk/contracts";
import { html, type Raw } from "../../html";
import { formatCents } from "../../shop/shop";

type Addon = StorefrontAddonsResponse["items"][number];

/** The variant an add-on is added as: its first. */
function addonVariant(addon: Addon): string | null {
	const first = (Array.isArray(addon.variants) ? addon.variants[0] : undefined) as
		| { variantId?: unknown; id?: unknown }
		| undefined;
	const id = first?.variantId ?? first?.id;
	return typeof id === "string" ? id : null;
}

/** "Complete your purchase": add-ons, each added to the cart by `<bd-addon>`. */
export function productAddons(addons: Addon[], { addUrl = "/api/bd/cart/add" } = {}): Raw {
	if (addons.length === 0) return html``;
	return html`<section class="product-section">
		<h2 class="product-section__title">Complete your purchase</h2>
		<div class="addon-grid">${addons.map((addon) => {
			const variantId = addonVariant(addon);
			return html`<div class="addon-card bd-card">
				<div class="addon-card__media">${
					addon.imageUrl
						? html`<img alt="${addon.addonName}" loading="lazy" referrerpolicy="no-referrer" src="${addon.imageUrl}" />`
						: html`<div class="addon-card__noimg">—</div>`
				}</div>
				<div class="addon-card__body">
					${addon.groupLabel ? html`<span class="addon-card__group">${addon.groupLabel}</span>` : ""}
					<p class="addon-card__name">${addon.addonName}</p>
					${addon.priceCents != null ? html`<span class="addon-card__price">${formatCents(addon.priceCents)}</span>` : ""}
				</div>
				<bd-addon data-add-url="${addUrl}" data-product-id="${addon.addonProductId}"${variantId ? html` data-variant-id="${variantId}"` : ""}><button class="bd-btn bd-btn--ghost addon-card__add" data-bd-add type="button">Add</button></bd-addon>
			</div>`;
		})}</div>
	</section>`;
}

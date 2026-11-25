// [bd-file:store]
import type { StorefrontAddonsResponse } from "@businessdash/sdk/contracts";
import { For, Show } from "solid-js";

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
export function ProductAddons(props: { addons: Addon[]; addUrl?: string }) {
	return (
		<Show when={props.addons.length > 0}>
			<section class="product-section">
				<h2 class="product-section__title">Complete your purchase</h2>
				<div class="addon-grid">
					<For each={props.addons}>
						{(addon) => (
							<div class="addon-card bd-card">
								<div class="addon-card__media">
									<Show
										when={addon.imageUrl}
										fallback={<div class="addon-card__noimg">—</div>}
									>
										{(src) => (
											<img
												alt={addon.addonName}
												loading="lazy"
												referrerpolicy="no-referrer"
												src={src()}
											/>
										)}
									</Show>
								</div>
								<div class="addon-card__body">
									<Show when={addon.groupLabel}>
										<span class="addon-card__group">{addon.groupLabel}</span>
									</Show>
									<p class="addon-card__name">{addon.addonName}</p>
									<Show when={addon.priceCents != null}>
										<span class="addon-card__price">
											{formatCents(addon.priceCents ?? 0)}
										</span>
									</Show>
								</div>
								<bd-addon
									data-add-url={props.addUrl ?? "/api/bd/cart/add"}
									data-product-id={addon.addonProductId}
									data-variant-id={addonVariant(addon)}
								>
									<button
										class="bd-btn bd-btn--ghost addon-card__add"
										data-bd-add
										type="button"
									>
										Add
									</button>
								</bd-addon>
							</div>
						)}
					</For>
				</div>
			</section>
		</Show>
	);
}

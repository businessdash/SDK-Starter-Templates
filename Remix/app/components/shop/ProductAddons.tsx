// [bd-file:store]
import type { StorefrontAddonsResponse } from "@businessdash/sdk/contracts";
import { useState } from "react";
import type { AddToCartInput, AddToCartResult } from "./ProductDetail";
import { formatCents } from "./shop";

export type Addon = StorefrontAddonsResponse["items"][number];

/** "Complete your purchase": add-ons, each with its own Add button. */
export function ProductAddons({
	addons,
	addToCart,
	onCartCount,
}: {
	addons: Addon[];
	addToCart: (input: AddToCartInput) => Promise<AddToCartResult>;
	/** Told the cart's new item count after an add. */
	onCartCount?: (count: number) => void;
}) {
	const [adding, setAdding] = useState<string | null>(null);
	const [added, setAdded] = useState<Record<string, boolean>>({});

	async function add(addon: Addon) {
		setAdding(addon.id);
		const first = (
			Array.isArray(addon.variants) ? addon.variants[0] : undefined
		) as { variantId?: unknown; id?: unknown } | undefined;
		const variant = first?.variantId ?? first?.id;
		const res = await addToCart({
			productId: addon.addonProductId,
			variantId: typeof variant === "string" ? variant : undefined,
			quantity: 1,
		});
		setAdding(null);
		if (res.ok) {
			onCartCount?.(res.itemCount);
			setAdded((prev) => ({ ...prev, [addon.id]: true }));
		}
	}

	if (addons.length === 0) return null;
	return (
		<section className="product-section">
			<h2 className="product-section__title">Complete your purchase</h2>
			<div className="addon-grid">
				{addons.map((addon) => (
					<div className="addon-card bd-card" key={addon.id}>
						<div className="addon-card__media">
							{addon.imageUrl ? (
								<img
									alt={addon.addonName}
									loading="lazy"
									referrerPolicy="no-referrer"
									src={addon.imageUrl}
								/>
							) : (
								<div className="addon-card__noimg">—</div>
							)}
						</div>
						<div className="addon-card__body">
							{addon.groupLabel && (
								<span className="addon-card__group">{addon.groupLabel}</span>
							)}
							<p className="addon-card__name">{addon.addonName}</p>
							{addon.priceCents != null && (
								<span className="addon-card__price">
									{formatCents(addon.priceCents)}
								</span>
							)}
						</div>
						<button
							className="bd-btn bd-btn--ghost addon-card__add"
							disabled={adding === addon.id || added[addon.id] === true}
							onClick={() => add(addon)}
							type="button"
						>
							{added[addon.id] ? "Added" : adding === addon.id ? "…" : "Add"}
						</button>
					</div>
				))}
			</div>
		</section>
	);
}

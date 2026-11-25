// [bd-file:store]
import { component$, type PropFunction } from "@builder.io/qwik";

import type { CartSnapshot } from "@businessdash/sdk/contracts";

import { formatDollars } from "../../../lib/bd-store";

/**
 * One line of the cart: photo, name and option, its total, − and +, and
 * Remove. `disabled` while a change is on its way.
 */
export const CartLine = component$<{
	item: CartSnapshot["items"][number];
	disabled: boolean;
	onQuantity$: PropFunction<(quantity: number) => void>;
	onRemove$: PropFunction<() => void>;
}>(({ item, disabled, onQuantity$, onRemove$ }) => {
	return (
		<div style="display: flex; gap: 1rem; align-items: center; border-bottom: 1px solid var(--border); padding-bottom: 1rem;">
			{item.productImage ? (
				<img
					alt={item.productName ?? "Item"}
					src={item.productImage}
					style="width: 64px; height: 64px; border-radius: 0.5rem; object-fit: cover;"
				/>
			) : null}
			<div style="flex: 1;">
				<div style="font-weight: 600; color: var(--title);">{item.productName ?? "Item"}</div>
				{item.variantTitle ? (
					<div style="color: var(--text-muted); font-size: 0.85rem;">{item.variantTitle}</div>
				) : null}
				<div style="color: var(--accent); font-weight: 600;">{formatDollars(item.subtotal, item.currency)}</div>
			</div>
			<div style="display: flex; align-items: center; gap: 0.5rem;">
				<button
					aria-label="Decrease quantity"
					class="slot-button"
					disabled={disabled}
					onClick$={() => onQuantity$(item.quantity - 1)}
					type="button"
				>
					−
				</button>
				<span style="min-width: 1.5rem; text-align: center;">{item.quantity}</span>
				<button
					aria-label="Increase quantity"
					class="slot-button"
					disabled={disabled}
					onClick$={() => onQuantity$(item.quantity + 1)}
					type="button"
				>
					+
				</button>
				<button class="bd-btn bd-btn--ghost" disabled={disabled} onClick$={() => onRemove$()} type="button">
					Remove
				</button>
			</div>
		</div>
	);
});

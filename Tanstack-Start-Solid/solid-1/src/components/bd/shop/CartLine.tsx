// [bd-file:store]
import type { CartSnapshot } from "@businessdash/sdk/contracts";
import { Show } from "solid-js";

import { formatMoney } from "../money";

/**
 * One line of the cart: photo, name and option, the price each, − and +,
 * and Remove. `disabled` while a change is on its way.
 */
export function CartLine(props: {
	item: CartSnapshot["items"][number];
	disabled: boolean;
	onQuantity: (quantity: number) => void;
	onRemove: () => void;
}) {
	const item = () => props.item;
	return (
		<div style="display: flex; align-items: center; gap: 1rem; padding-bottom: 1rem; border-bottom: 1px solid var(--border);">
			<Show when={item().productImage}>
				<img
					src={item().productImage ?? ""}
					alt={item().productName ?? "Item"}
					style="width: 64px; height: 64px; object-fit: cover; border-radius: 0.5rem;"
				/>
			</Show>
			<div style="flex: 1;">
				<div style="font-weight: 600; color: var(--title);">
					{item().productName ?? "Item"}
				</div>
				<Show when={item().variantTitle}>
					<div style="font-size: 0.82rem; color: var(--text-muted);">
						{item().variantTitle}
					</div>
				</Show>
				<div style="font-size: 0.85rem; color: var(--text-muted);">
					{formatMoney(Math.round(item().unitPrice * 100), item().currency)}{" "}
					each
				</div>
			</div>
			<div style="display: flex; align-items: center; gap: 0.5rem;">
				<button
					type="button"
					class="slot-button"
					disabled={props.disabled}
					onClick={() => props.onQuantity(Math.max(0, item().quantity - 1))}
				>
					−
				</button>
				<span style="min-width: 1.5rem; text-align: center;">
					{item().quantity}
				</span>
				<button
					type="button"
					class="slot-button"
					disabled={props.disabled}
					onClick={() => props.onQuantity(item().quantity + 1)}
				>
					+
				</button>
			</div>
			<button
				type="button"
				class="bd-btn bd-btn--ghost"
				disabled={props.disabled}
				onClick={() => props.onRemove()}
			>
				Remove
			</button>
		</div>
	);
}

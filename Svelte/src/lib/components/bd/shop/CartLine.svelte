<!-- [bd-file:store] -->
<script lang="ts">
	/** One line in the cart: photo, name, option, price each, quantity, Remove, and the line's total. */
	import type { CartSnapshot } from '@businessdash/sdk/contracts';
	import { formatDollars } from '#lib/bd/cart-client.ts';

	let {
		item,
		currency,
		busy = false,
		onQuantity,
		onRemove
	}: {
		item: CartSnapshot['items'][number];
		currency: string;
		busy?: boolean;
		onQuantity: (quantity: number) => void;
		onRemove: () => void;
	} = $props();
</script>

<div class="cart-row">
	{#if item.productImage}
		<img class="cart-row__img" src={item.productImage} alt={item.productName ?? ''} />
	{/if}
	<div class="cart-row__main">
		<strong>{item.productName ?? 'Item'}</strong>
		{#if item.variantTitle}
			<span class="cart-row__variant">{item.variantTitle}</span>
		{/if}
		<span class="cart-row__unit">{formatDollars(item.unitPrice, currency)} ea</span>
	</div>
	<div class="cart-row__qty">
		<input
			class="bd-input"
			type="number"
			min="0"
			max="999"
			value={item.quantity}
			onchange={(e) => onQuantity(Number(e.currentTarget.value))}
			style="width: 4.5rem;"
			disabled={busy}
		/>
		<button class="cart-row__remove" onclick={onRemove} disabled={busy} aria-label="Remove item">
			Remove
		</button>
	</div>
	<div class="cart-row__subtotal">{formatDollars(item.subtotal, currency)}</div>
</div>

<style>
	.cart-row {
		display: grid;
		grid-template-columns: auto 1fr auto auto;
		align-items: center;
		gap: 1rem;
		padding-bottom: 1rem;
		border-bottom: 1px solid var(--border);
	}
	.cart-row__img {
		width: 3.5rem;
		height: 3.5rem;
		object-fit: cover;
		border-radius: 0.5rem;
	}
	.cart-row__main {
		display: flex;
		flex-direction: column;
		gap: 0.15rem;
	}
	.cart-row__variant,
	.cart-row__unit {
		color: var(--text-muted);
		font-size: 0.82rem;
	}
	.cart-row__qty {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.cart-row__remove {
		background: none;
		border: none;
		color: var(--danger);
		font-size: 0.8rem;
		text-decoration: underline;
	}
	.cart-row__subtotal {
		font-weight: 700;
		min-width: 5rem;
		text-align: right;
	}
</style>

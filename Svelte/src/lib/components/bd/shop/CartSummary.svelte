<!-- [bd-file:store] -->
<script lang="ts">
	/** The subtotal. */
	import { formatDollars } from '#lib/bd/cart-client.ts';

	let { subtotal, currency }: { subtotal: number; currency: string } = $props();
</script>

<div class="cart-total">
	<span>Subtotal</span>
	<strong>{formatDollars(subtotal, currency)}</strong>
</div>

<style>
	.cart-total {
		display: flex;
		justify-content: space-between;
		align-items: center;
		font-size: 1.1rem;
		padding-top: 0.5rem;
		border-top: 1px solid var(--border);
	}
</style>

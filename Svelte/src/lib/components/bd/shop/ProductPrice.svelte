<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * The price for what's chosen times the quantity: "From" until every option
	 * is picked, the price each when buying more than one, Sold out when there's
	 * none. `price` is from priceFor().
	 */
	import { formatDollars, type Price } from '#lib/bd/shop.ts';

	let { price, quantity = 1 }: { price: Price | null; quantity?: number } = $props();
</script>

<p class="product-detail__price">
	{#if price?.amount != null}
		{#if price.from}<span class="product-detail__from">From</span>{/if}
		{formatDollars(price.amount * quantity)}
		{#if quantity > 1}<span class="product-detail__each">
				({formatDollars(price.amount)} each)</span
			>{/if}
	{:else}
		Sold out
	{/if}
</p>

<style>
	.product-detail__price {
		margin: 0;
		color: var(--title);
		font-size: 1.6rem;
		font-weight: 700;
	}
	.product-detail__from,
	.product-detail__each {
		color: var(--text-muted);
		font-size: 0.9rem;
		font-weight: 500;
	}
</style>

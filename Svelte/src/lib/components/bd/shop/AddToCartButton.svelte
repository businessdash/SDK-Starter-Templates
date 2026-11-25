<!-- [bd-file:store] -->
<script lang="ts">
	/** Add to cart; "Choose options" until every option is picked, Sold out when there's none, "Adding…" while it's sent. */
	import type { Price } from '#lib/bd/shop.ts';

	let {
		price,
		busy = false,
		onAdd
	}: { price: Price | null; busy?: boolean; onAdd: () => void } = $props();

	const label = $derived(
		!price || price.amount === null
			? 'Sold out'
			: !price.ready
				? 'Choose options'
				: busy
					? 'Adding…'
					: 'Add to cart'
	);
</script>

<button class="bd-btn buy__add" onclick={onAdd} disabled={busy || !price?.ready}>
	{label}
</button>

<style>
	.buy__add {
		flex: 1;
		justify-content: center;
	}
</style>

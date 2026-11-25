<!-- [bd-file:store] -->
<script lang="ts">
	/** The store's products, a product card each. */
	import type { ComponentProps } from 'svelte';
	import ProductCard from './ProductCard.svelte';

	let {
		products,
		storeHref = '/store'
	}: { products: readonly ComponentProps<typeof ProductCard>['product'][]; storeHref?: string } =
		$props();
</script>

<div class="bd-grid-3">
	{#each products as product (product.id)}
		<ProductCard {product} {storeHref} />
	{/each}
</div>

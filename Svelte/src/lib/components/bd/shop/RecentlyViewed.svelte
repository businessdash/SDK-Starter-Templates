<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * What this browser opened before, as a rail; this product joins the list
	 * for next time. The list lives in this browser, so it shows once the page
	 * is there.
	 */
	import { onMount } from 'svelte';
	import { recentlyViewed, type SavedProduct } from '#lib/bd/shop.ts';
	import ProductRail from '../ProductRail.svelte';

	let { product }: { product: SavedProduct | null } = $props();
	let recent = $state<SavedProduct[]>([]);

	onMount(() => {
		if (!product) return;
		// Shown before this one is added, so the product isn't in its own list.
		recent = recentlyViewed.read().filter((item) => item.id !== product.id);
		recentlyViewed.add(product);
	});
</script>

<ProductRail title="Recently viewed" products={recent} />

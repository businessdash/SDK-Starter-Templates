<!-- [bd-file:store] -->
<script lang="ts">
	/** Store / Category / This product. */
	import type { ProductView } from '#lib/bd/shop.ts';

	let { product, storeHref = '/store' }: { product: ProductView; storeHref?: string } = $props();
</script>

<nav class="crumbs" aria-label="Breadcrumb">
	<a href={storeHref}>Store</a>
	{#if product.categoryId}
		<span aria-hidden="true">/</span>
		<a href={`${storeHref}?category=${product.categoryId}`}>{product.categoryName ?? 'Category'}</a>
	{/if}
	<span aria-hidden="true">/</span>
	<span aria-current="page">{product.name}</span>
</nav>

<style>
	.crumbs {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		font-size: 0.88rem;
		color: var(--text-muted);
	}
	.crumbs a {
		border-bottom: none;
	}
</style>

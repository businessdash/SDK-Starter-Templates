<!-- [bd-file:store] -->
<script lang="ts">
	/** The category, the name, and the stars linking to the reviews. */
	import type { ProductView } from '#lib/bd/shop.ts';
	import StarRating from './StarRating.svelte';

	let {
		product,
		reviews
	}: { product: ProductView; reviews: { avgRating: number; totalCount: number } | null } = $props();
</script>

<div>
	{#if product.categoryName}<p class="product-detail__eyebrow">{product.categoryName}</p>{/if}
	<h1>{product.name}</h1>
	{#if reviews && reviews.totalCount > 0}
		<a class="product-detail__rating" href="#reviews">
			<StarRating rating={reviews.avgRating} />
			<span>{reviews.avgRating.toFixed(1)} · {reviews.totalCount} reviews</span>
		</a>
	{/if}
</div>

<style>
	:global(.product-detail__info) h1 {
		font-size: clamp(1.6rem, 3vw, 2.1rem);
	}
	.product-detail__eyebrow {
		margin: 0 0 0.25rem;
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 600;
		text-transform: uppercase;
		letter-spacing: 0.06em;
	}
	.product-detail__rating {
		display: inline-flex;
		align-items: center;
		gap: 0.5rem;
		margin-top: 0.5rem;
		font-size: 0.9rem;
		color: var(--text-muted);
		border-bottom: none;
	}
</style>

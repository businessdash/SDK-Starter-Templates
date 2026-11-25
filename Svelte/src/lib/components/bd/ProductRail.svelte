<!-- [bd-file:store] -->
<script lang="ts">
	/** A row of small product cards: related products, recently viewed. */
	import { formatCents, type SavedProduct } from '#lib/bd/shop.ts';

	let { title, products }: { title: string; products: SavedProduct[] } = $props();
</script>

{#if products.length > 0}
	<section class="product-rail">
		<h2 class="product-rail__title">{title}</h2>
		<ul class="product-rail__row">
			{#each products as product (product.id)}
				<li>
					<a class="bd-card product-rail__card" href={`/store/${product.id}`}>
						{#if product.image}
							<img src={product.image} alt="" loading="lazy" referrerpolicy="no-referrer" />
						{:else}
							<span class="product-rail__noimg" aria-hidden="true"></span>
						{/if}
						<span class="product-rail__name">{product.name}</span>
						{#if product.priceCents != null}
							<span class="product-rail__price">{formatCents(product.priceCents)}</span>
						{/if}
					</a>
				</li>
			{/each}
		</ul>
	</section>
{/if}

<style>
	.product-rail {
		margin-top: 3rem;
	}
	.product-rail__title {
		font-size: 1.25rem;
		margin-bottom: 1rem;
	}
	.product-rail__row {
		display: grid;
		grid-auto-flow: column;
		grid-auto-columns: minmax(10rem, 13rem);
		gap: 1rem;
		overflow-x: auto;
		padding: 0 0 0.75rem;
		margin: 0;
		list-style: none;
		scroll-snap-type: x mandatory;
	}
	.product-rail__row li {
		scroll-snap-align: start;
	}
	.product-rail__card {
		display: flex;
		flex-direction: column;
		gap: 0.4rem;
		height: 100%;
		padding: 0.75rem;
		border-bottom: none;
	}
	.product-rail__card img,
	.product-rail__noimg {
		display: block;
		width: 100%;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 0.6rem;
		background: var(--bg-soft);
	}
	.product-rail__name {
		color: var(--title);
		font-weight: 600;
		font-size: 0.9rem;
	}
	.product-rail__price {
		color: var(--text-muted);
		font-size: 0.85rem;
	}
</style>

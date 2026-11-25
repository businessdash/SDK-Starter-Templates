<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * A product in the store's grid: its photo and badges (Best seller, New,
	 * Sale), name, stars, price ("From" when options change it, the old price
	 * on sale), Low stock, and ♡ / ⇄ to save it or pick it to compare.
	 */
	import SaveButtons from '../SaveButtons.svelte';
	import StarRating from './StarRating.svelte';

	type Card = {
		id: string;
		name: string;
		coverImage: string | null;
		isBestSeller?: boolean;
		isNew?: boolean;
		isOnSale?: boolean;
		isLowStock?: boolean;
		reviewCount: number;
		avgRating: number;
		cheapestPriceCents: number | null;
		comparePriceCents: number | null;
		hasMultipleVariants?: boolean;
	};

	let { product, storeHref = '/store' }: { product: Card; storeHref?: string } = $props();

	function priceLabel(cents: number | null): string {
		if (cents == null) return '—';
		const dollars = cents / 100;
		return `$${dollars.toLocaleString(undefined, {
			minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
			maximumFractionDigits: 2
		})}`;
	}
</script>

<div class="bd-card product-card">
	<a class="product-card__link" href={`${storeHref}/${product.id}`}>
		<div class="product-card__media">
			{#if product.coverImage}
				<img
					class="product-card__img"
					src={product.coverImage}
					alt={product.name}
					loading="lazy"
					referrerpolicy="no-referrer"
				/>
			{:else}
				<div class="product-card__noimg">No image</div>
			{/if}
			<div class="product-card__badges">
				{#if product.isBestSeller}
					<span class="bd-badge">Best seller</span>
				{/if}
				{#if product.isNew}
					<span class="bd-badge">New</span>
				{/if}
				{#if product.isOnSale}
					<span class="bd-badge product-card__badge--sale">Sale</span>
				{/if}
			</div>
		</div>
		<div class="product-card__body">
			<h3>{product.name || 'Untitled'}</h3>
			{#if product.reviewCount > 0}
				<div class="product-card__rating">
					<StarRating rating={product.avgRating} />
					<span class="product-card__count">({product.reviewCount})</span>
				</div>
			{/if}
			<div class="product-card__price">
				<span class="product-card__amount">
					{product.hasMultipleVariants ? 'From ' : ''}{priceLabel(product.cheapestPriceCents)}
				</span>
				{#if product.isOnSale && product.comparePriceCents != null}
					<span class="product-card__compare">
						{priceLabel(product.comparePriceCents)}
					</span>
				{/if}
			</div>
			{#if product.isLowStock}
				<span class="product-card__lowstock">Low stock</span>
			{/if}
		</div>
	</a>
	<div class="product-card__save">
		<SaveButtons
			compact
			product={{
				id: product.id,
				name: product.name,
				image: product.coverImage,
				priceCents: product.cheapestPriceCents
			}}
		/>
	</div>
</div>

<style>
	.product-card {
		position: relative;
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: inherit;
	}
	.product-card__link {
		display: flex;
		flex: 1;
		flex-direction: column;
		color: inherit;
		border-bottom: none;
	}
	.product-card__save {
		position: absolute;
		top: 0.6rem;
		right: 0.6rem;
	}
	.product-card:hover {
		border-bottom-color: transparent;
	}
	.product-card__media {
		position: relative;
	}
	.product-card__img {
		width: 100%;
		aspect-ratio: 4 / 3;
		object-fit: cover;
	}
	.product-card__noimg {
		display: grid;
		place-items: center;
		aspect-ratio: 4 / 3;
		background: var(--bg-soft);
		color: var(--text-muted);
		font-size: 0.85rem;
	}
	.product-card__badges {
		position: absolute;
		top: 0.6rem;
		left: 0.6rem;
		display: flex;
		flex-wrap: wrap;
		gap: 0.35rem;
	}
	.product-card__badge--sale {
		background: var(--danger-bg);
		color: var(--danger);
		border-color: var(--danger);
	}
	.product-card__body {
		padding: 1.25rem 1.5rem;
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		flex: 1;
	}
	.product-card__body h3 {
		font-size: 1.05rem;
	}
	.product-card__rating {
		display: flex;
		align-items: center;
		gap: 0.4rem;
	}
	.product-card__count {
		font-size: 0.78rem;
		color: var(--text-muted);
	}
	.product-card__price {
		margin-top: auto;
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
		padding-top: 0.25rem;
	}
	.product-card__amount {
		color: var(--accent);
		font-weight: 700;
		font-size: 1.05rem;
	}
	.product-card__compare {
		color: var(--text-muted);
		font-size: 0.85rem;
		text-decoration: line-through;
	}
	.product-card__lowstock {
		font-size: 0.72rem;
		font-weight: 700;
		letter-spacing: 0.05em;
		text-transform: uppercase;
		color: var(--danger);
	}
</style>

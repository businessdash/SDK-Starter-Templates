<script lang="ts">
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Header from '$lib/components/bd/Header.svelte';
	import Footer from '$lib/components/bd/Footer.svelte';
	import StoreNav from '$lib/components/bd/StoreNav.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	const SORT_LABELS: Record<string, string> = {
		featured: 'Featured',
		newest: 'Newest',
		'price-asc': 'Price: low to high',
		'price-desc': 'Price: high to low',
		'rating-desc': 'Top rated'
	};

	function priceLabel(cents: number | null): string {
		if (cents == null) return '—';
		const dollars = cents / 100;
		return `$${dollars.toLocaleString(undefined, {
			minimumFractionDigits: dollars % 1 === 0 ? 0 : 2,
			maximumFractionDigits: 2
		})}`;
	}

	// Map category id → live product count for the sidebar.
	const countByCategory = $derived(
		new Map(data.meta.categoryCounts.map((c) => [c.categoryId, c.count]))
	);

	const hasFilters = $derived(
		Boolean(
			data.filters.search ||
				data.filters.categoryId ||
				data.filters.minRating ||
				data.filters.minDollars != null ||
				data.filters.maxDollars != null
		)
	);

	/** Set/clear one search param and navigate, keeping scroll + focus. */
	function setParam(key: string, value: string | null) {
		const params = new URLSearchParams(page.url.searchParams);
		if (value === null || value === '') params.delete(key);
		else params.set(key, value);
		const qs = params.toString();
		goto(qs ? `/store?${qs}` : '/store', { keepFocus: true, noScroll: true });
	}

	function onSearch(e: SubmitEvent) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		const q = String(fd.get('q') ?? '').trim();
		setParam('q', q || null);
	}

	function onPrice(e: SubmitEvent) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		const min = String(fd.get('min') ?? '').trim();
		const max = String(fd.get('max') ?? '').trim();
		setParam('price', min || max ? `${min || ''}-${max || ''}` : null);
	}

	function clearAll() {
		goto('/store', { keepFocus: true, noScroll: true });
	}
</script>

{#snippet stars(rating: number)}
	<span class="stars" role="img" aria-label={`${rating.toFixed(1)} out of 5`}>
		{#each [0, 1, 2, 3, 4] as i (i)}
			{@const filled = rating >= i + 1}
			{@const half = !filled && rating >= i + 0.5}
			<span class="stars__star" class:stars__star--on={filled} class:stars__star--half={half}>
				★
			</span>
		{/each}
	</span>
{/snippet}

<svelte:head><title>Store</title></svelte:head>

<Header />
<StoreNav cartCount={data.cartCount} />

<main class="bd-section">
	<div class="bd-section__lead">
		<span class="bd-section__eyebrow">Shop</span>
		<h1 class="bd-section__title">Products</h1>
		<p class="bd-section__sub">
			Live catalog from the BD storefront surface. Filter, sort, and click a
			product to choose a variant and add it to your cart.
		</p>
	</div>

	{#if !data.configured}
		<div class="bd-empty">
			Store isn't connected yet. Set <code>BD_API_KEY</code>,
			<code>BD_SITE_ID</code> and <code>BD_PACKAGE_API_BASE_URL</code> in your
			environment, then add products in the BD dashboard.
		</div>
	{:else}
		<div class="store-layout">
			<aside class="store-sidebar">
				<form onsubmit={onSearch}>
					<label class="bd-label" for="store-search">Search</label>
					<input
						id="store-search"
						class="bd-input"
						type="search"
						name="q"
						placeholder="Search products…"
						value={data.filters.search ?? ''}
						autocomplete="off"
					/>
				</form>

				{#if data.categories.length > 0}
					<div class="store-facet">
						<p class="store-facet__title">Category</p>
						<ul class="store-facet__list">
							<li>
								<button
									type="button"
									class="store-facet__item"
									class:store-facet__item--active={!data.filters.categoryId}
									onclick={() => setParam('category', null)}
								>
									All products
								</button>
							</li>
							{#each data.categories as c (c.id)}
								{@const active = data.filters.categoryId === c.id}
								<li>
									<button
										type="button"
										class="store-facet__item store-facet__item--row"
										class:store-facet__item--active={active}
										onclick={() => setParam('category', active ? null : c.id)}
									>
										<span>{c.name}</span>
										<span class="store-facet__count">{countByCategory.get(c.id) ?? 0}</span>
									</button>
								</li>
							{/each}
						</ul>
					</div>
				{/if}

				<form class="store-facet" onsubmit={onPrice}>
					<p class="store-facet__title">Price</p>
					<div class="store-price">
						<input
							class="bd-input"
							inputmode="numeric"
							name="min"
							placeholder={`$${data.meta.priceRange.minDollars}`}
							value={data.filters.minDollars ?? ''}
						/>
						<span class="store-price__sep">–</span>
						<input
							class="bd-input"
							inputmode="numeric"
							name="max"
							placeholder={`$${data.meta.priceRange.maxDollars}`}
							value={data.filters.maxDollars ?? ''}
						/>
					</div>
					<button type="submit" class="bd-btn bd-btn--ghost store-price__apply">
						Apply
					</button>
				</form>

				<div class="store-facet">
					<p class="store-facet__title">Rating</p>
					<ul class="store-facet__list">
						{#each [4, 3, 2] as r (r)}
							{@const active = data.filters.minRating === r}
							<li>
								<button
									type="button"
									class="store-facet__item store-facet__rating"
									class:store-facet__item--active={active}
									onclick={() => setParam('rating', active ? null : String(r))}
								>
									{@render stars(r)}
									<span class="store-facet__count">&amp; up</span>
								</button>
							</li>
						{/each}
					</ul>
				</div>

				{#if hasFilters}
					<button type="button" class="store-clear" onclick={clearAll}>
						Clear all filters
					</button>
				{/if}
			</aside>

			<div class="store-results">
				<div class="store-results__bar">
					<p class="bd-loading">
						{data.meta.items.length}
						{data.meta.items.length === 1 ? 'product' : 'products'}
					</p>
					<label class="store-sort">
						<span>Sort</span>
						<select
							class="bd-select"
							value={data.filters.sort ?? 'featured'}
							onchange={(e) =>
								setParam(
									'sort',
									e.currentTarget.value === 'featured' ? null : e.currentTarget.value
								)}
						>
							{#each Object.entries(SORT_LABELS) as [value, label] (value)}
								<option {value}>{label}</option>
							{/each}
						</select>
					</label>
				</div>

				{#if data.meta.items.length === 0}
					<div class="bd-empty">
						{hasFilters
							? 'No products match these filters. Try clearing a filter or broadening your search.'
							: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
					</div>
				{:else}
					<div class="bd-grid-3">
						{#each data.meta.items as product (product.id)}
							<a class="bd-card product-card" href={`/store/${product.id}`}>
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
											{@render stars(product.avgRating)}
											<span class="product-card__count">({product.reviewCount})</span>
										</div>
									{/if}
									<div class="product-card__price">
										<span class="product-card__amount">
											{product.hasMultipleVariants ? 'From ' : ''}{priceLabel(
												product.cheapestPriceCents
											)}
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
						{/each}
					</div>
				{/if}
			</div>
		</div>
	{/if}
</main>

<Footer />

<style>
	.store-layout {
		display: grid;
		grid-template-columns: 1fr;
		gap: 2rem;
	}
	@media (min-width: 900px) {
		.store-layout {
			grid-template-columns: 15rem minmax(0, 1fr);
			gap: 2.5rem;
		}
	}

	.store-sidebar {
		display: flex;
		flex-direction: column;
		gap: 1.75rem;
	}
	@media (min-width: 900px) {
		.store-sidebar {
			position: sticky;
			top: 5.5rem;
			align-self: start;
		}
	}

	.store-facet__title {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--subtitle);
		margin-bottom: 0.75rem;
	}
	.store-facet__list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 0.25rem;
	}
	.store-facet__item {
		width: 100%;
		text-align: left;
		background: transparent;
		border: none;
		padding: 0.15rem 0;
		color: var(--text-muted);
		font-size: 0.9rem;
		transition: color 0.12s ease;
	}
	.store-facet__item--row,
	.store-facet__rating {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
	}
	.store-facet__rating {
		justify-content: flex-start;
	}
	.store-facet__item:hover {
		color: var(--text);
	}
	.store-facet__item--active {
		color: var(--accent);
		font-weight: 600;
	}
	.store-facet__count {
		font-size: 0.78rem;
		color: var(--text-muted);
	}

	.store-price {
		display: flex;
		align-items: center;
		gap: 0.5rem;
	}
	.store-price__sep {
		color: var(--text-muted);
	}
	.store-price__apply {
		margin-top: 0.6rem;
		width: 100%;
	}

	.store-clear {
		align-self: flex-start;
		background: transparent;
		border: none;
		padding: 0;
		color: var(--accent);
		font-size: 0.8rem;
		font-weight: 600;
		letter-spacing: 0.04em;
		text-transform: uppercase;
	}
	.store-clear:hover {
		color: var(--accent-strong);
	}

	.store-results__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
	.store-sort {
		display: flex;
		align-items: center;
		gap: 0.5rem;
		font-size: 0.9rem;
		color: var(--text-muted);
	}
	.store-sort .bd-select {
		width: auto;
	}

	.stars {
		display: inline-flex;
		gap: 0.05rem;
		line-height: 1;
	}
	.stars__star {
		color: var(--border-strong);
		font-size: 0.85rem;
	}
	.stars__star--on {
		color: #e8a317;
	}
	.stars__star--half {
		background: linear-gradient(90deg, #e8a317 50%, var(--border-strong) 50%);
		-webkit-background-clip: text;
		background-clip: text;
		color: transparent;
	}

	.product-card {
		display: flex;
		flex-direction: column;
		overflow: hidden;
		color: inherit;
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

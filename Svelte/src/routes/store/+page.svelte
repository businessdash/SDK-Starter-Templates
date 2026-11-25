<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * The product list, laid out from the shop's parts in
	 * `#lib/components/bd/shop/`: the filters (search, category, price,
	 * rating, clear, sort) and a product card per product. Every filter is in
	 * the URL, so a filtered list can be shared.
	 */
	import { goto } from '$app/navigation';
	import { page } from '$app/state';
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import StoreNav from '#lib/components/bd/StoreNav.svelte';
	import CompareBar from '#lib/components/bd/CompareBar.svelte';
	import CategoryFilter from '#lib/components/bd/shop/CategoryFilter.svelte';
	import ClearFilters from '#lib/components/bd/shop/ClearFilters.svelte';
	import PriceFilter from '#lib/components/bd/shop/PriceFilter.svelte';
	import ProductGrid from '#lib/components/bd/shop/ProductGrid.svelte';
	import RatingFilter from '#lib/components/bd/shop/RatingFilter.svelte';
	import SortSelect from '#lib/components/bd/shop/SortSelect.svelte';
	import StoreSearch from '#lib/components/bd/shop/StoreSearch.svelte';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Each category with its live product count, for the sidebar.
	const categories = $derived.by(() => {
		const counts = new Map(data.meta.categoryCounts.map((c) => [c.categoryId, c.count]));
		return data.categories.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }));
	});

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
		const params = new URLSearchParams(page.url.search);
		if (value === null || value === '') params.delete(key);
		else params.set(key, value);
		const qs = params.toString();
		goto(qs ? `/store?${qs}` : '/store', { reset: false });
	}

	function clearAll() {
		goto('/store', { reset: false });
	}
</script>

<svelte:head><title>Store</title></svelte:head>

<Header />
<StoreNav cartCount={data.cartCount} />

<main class="bd-section">
	<div class="bd-section__lead">
		<span class="bd-section__eyebrow">Shop</span>
		<h1 class="bd-section__title">Products</h1>
		<p class="bd-section__sub">
			Live catalog from the BD storefront surface. Filter, sort, and click a product to choose a
			variant and add it to your cart.
		</p>
	</div>

	{#if !data.configured}
		<div class="bd-empty">
			Store isn't connected yet. Set <code>BD_API_KEY</code>,
			<code>BD_SITE_ID</code> and <code>BD_PACKAGE_API_BASE_URL</code> in your environment, then add products
			in the BD dashboard.
		</div>
	{:else}
		<div class="store-layout">
			<aside class="store-sidebar">
				<StoreSearch value={data.filters.search ?? ''} onSearch={(q) => setParam('q', q || null)} />
				<CategoryFilter
					{categories}
					selected={data.filters.categoryId}
					onSelect={(id) => setParam('category', id)}
				/>
				<PriceFilter
					min={data.filters.minDollars}
					max={data.filters.maxDollars}
					range={data.meta.priceRange}
					onApply={(min, max) => setParam('price', min || max ? `${min || ''}-${max || ''}` : null)}
				/>
				<RatingFilter
					selected={data.filters.minRating}
					onSelect={(r) => setParam('rating', r === null ? null : String(r))}
				/>
				{#if hasFilters}
					<ClearFilters onClear={clearAll} />
				{/if}
			</aside>

			<div class="store-results">
				<div class="store-results__bar">
					<p class="bd-loading">
						{data.meta.items.length}
						{data.meta.items.length === 1 ? 'product' : 'products'}
					</p>
					<SortSelect
						value={data.filters.sort ?? 'featured'}
						onSort={(sort) => setParam('sort', sort === 'featured' ? null : sort)}
					/>
				</div>

				{#if data.meta.items.length === 0}
					<div class="bd-empty">
						{hasFilters
							? 'No products match these filters. Try clearing a filter or broadening your search.'
							: "No live products yet. Add and publish products in the BD dashboard and they'll appear here."}
					</div>
				{:else}
					<ProductGrid products={data.meta.items} />
				{/if}
				<CompareBar />
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
	.store-results__bar {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 1rem;
		margin-bottom: 1.5rem;
	}
</style>

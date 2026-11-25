<!-- [bd-file:store] -->
<script lang="ts">
	import { onMount } from 'svelte';
	import { goto } from '$app/navigation';
	import Header from '#lib/components/bd/Header.svelte';
	import Footer from '#lib/components/bd/Footer.svelte';
	import StoreNav from '#lib/components/bd/StoreNav.svelte';
	import { compareList, defaultVariant, formatDollars } from '#lib/bd/shop.ts';
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();

	// Opened from the nav, the picks are only in this browser: put them in the URL.
	onMount(() => {
		if (data.ids.length > 0) return;
		const ids = compareList.read().map((item) => item.id);
		if (ids.length > 0) goto(`/store/compare?ids=${ids.join(',')}`, { replaceState: true });
	});

	function remove(id: string) {
		compareList.remove(id);
		const rest = data.ids.filter((other) => other !== id);
		goto(rest.length ? `/store/compare?ids=${rest.join(',')}` : '/store/compare', {
			replaceState: true
		});
	}

	/** Every spec row any of the products has, grouped, in first-seen order. */
	const specRows = $derived.by(() => {
		const rows: { group: string; label: string }[] = [];
		const seen = new Set<string>();
		for (const { view } of data.columns) {
			for (const group of view.specs) {
				for (const row of group.rows) {
					const key = `${group.name}\u0000${row.label}`;
					if (!seen.has(key)) {
						seen.add(key);
						rows.push({ group: group.name, label: row.label });
					}
				}
			}
		}
		return rows;
	});

	function specValue(columnIndex: number, group: string, label: string): string {
		const view = data.columns[columnIndex]?.view;
		return (
			view?.specs.find((g) => g.name === group)?.rows.find((r) => r.label === label)?.value ?? '—'
		);
	}

	function startingPrice(index: number): string {
		const view = data.columns[index]?.view;
		const variant = view ? defaultVariant(view) : undefined;
		return variant?.price != null ? formatDollars(variant.price) : '—';
	}
</script>

<svelte:head><title>Compare products</title></svelte:head>

<Header />
<StoreNav cartCount={data.cartCount} />

<main class="bd-section">
	<div class="bd-section__lead">
		<h1 class="bd-section__title">Compare products</h1>
		<p class="bd-section__sub">Up to four side by side.</p>
	</div>

	{#if !data.configured}
		<div class="bd-empty">Store isn't connected.</div>
	{:else if data.columns.length === 0}
		<div class="bd-empty">
			Nothing to compare yet. Press <span aria-hidden="true">⇄</span> Compare on two or more
			products.
			<p><a class="bd-btn" href="/store">Browse products</a></p>
		</div>
	{:else}
		<div class="compare-scroll">
			<table class="compare">
				<caption class="visually-hidden">Products compared</caption>
				<thead>
					<tr>
						<td></td>
						{#each data.columns as { view } (view.id)}
							<th scope="col">
								<a href={`/store/${view.id}`} class="compare__product">
									{#if view.images[0]}
										<img src={view.images[0]} alt="" referrerpolicy="no-referrer" />
									{/if}
									<span>{view.name}</span>
								</a>
								<button type="button" class="compare__remove" onclick={() => remove(view.id)}>
									Remove
								</button>
							</th>
						{/each}
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Price</th>
						{#each data.columns as column, i (column.view.id)}<td>{startingPrice(i)}</td>{/each}
					</tr>
					<tr>
						<th scope="row">Rating</th>
						{#each data.columns as { view, rating } (view.id)}
							<td>{rating ? `${rating.avg.toFixed(1)} ★ (${rating.count})` : 'No reviews'}</td>
						{/each}
					</tr>
					<tr>
						<th scope="row">Category</th>
						{#each data.columns as { view } (view.id)}<td>{view.categoryName ?? '—'}</td>{/each}
					</tr>
					<tr>
						<th scope="row">Options</th>
						{#each data.columns as { view } (view.id)}
							<td>{view.variants.map((v) => v.name).join(', ') || '—'}</td>
						{/each}
					</tr>
					{#each specRows as row (row.group + row.label)}
						<tr>
							<th scope="row">{row.label} <small>{row.group}</small></th>
							{#each data.columns as column, i (column.view.id)}
								<td>{specValue(i, row.group, row.label)}</td>
							{/each}
						</tr>
					{/each}
					<tr>
						<td></td>
						{#each data.columns as { view } (view.id)}
							<td><a class="bd-btn" href={`/store/${view.id}`}>View product</a></td>
						{/each}
					</tr>
				</tbody>
			</table>
		</div>
	{/if}
</main>

<Footer />

<style>
	.compare-scroll {
		position: relative;
		overflow-x: auto;
	}
	.compare {
		width: 100%;
		min-width: 40rem;
		border-collapse: collapse;
		font-size: 0.92rem;
	}
	.compare th,
	.compare td {
		padding: 0.75rem;
		border-top: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}
	.compare thead th {
		border-top: none;
	}
	.compare tbody th {
		width: 12rem;
		color: var(--text-muted);
		font-weight: 500;
	}
	.compare tbody th small {
		display: block;
		font-size: 0.75rem;
		opacity: 0.8;
	}
	.compare__product {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		color: var(--title);
		font-weight: 700;
		border-bottom: none;
	}
	.compare__product img {
		width: 100%;
		max-width: 11rem;
		aspect-ratio: 1;
		object-fit: cover;
		border-radius: 0.6rem;
		background: var(--bg-soft);
	}
	.compare__remove {
		margin-top: 0.4rem;
		padding: 0;
		border: none;
		background: none;
		color: var(--text-muted);
		font: inherit;
		font-size: 0.82rem;
		text-decoration: underline;
		cursor: pointer;
	}
	.visually-hidden {
		position: absolute;
		width: 1px;
		height: 1px;
		overflow: hidden;
		clip: rect(0 0 0 0);
		white-space: nowrap;
	}
</style>

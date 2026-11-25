<!-- [bd-file:store] -->
<script lang="ts">
	/** All products, then each category with how many products it has; `onSelect(null)` for all. */
	let {
		categories,
		selected = null,
		onSelect
	}: {
		categories: { id: string; name: string; count: number }[];
		selected?: string | null;
		onSelect: (categoryId: string | null) => void;
	} = $props();
</script>

{#if categories.length > 0}
	<div class="store-facet">
		<p class="store-facet__title">Category</p>
		<ul class="store-facet__list">
			<li>
				<button
					type="button"
					class="store-facet__item"
					class:store-facet__item--active={!selected}
					onclick={() => onSelect(null)}
				>
					All products
				</button>
			</li>
			{#each categories as c (c.id)}
				{@const active = selected === c.id}
				<li>
					<button
						type="button"
						class="store-facet__item store-facet__item--row"
						class:store-facet__item--active={active}
						onclick={() => onSelect(active ? null : c.id)}
					>
						<span>{c.name}</span>
						<span class="store-facet__count">{c.count}</span>
					</button>
				</li>
			{/each}
		</ul>
	</div>
{/if}

<style>
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
	.store-facet__item--row {
		display: flex;
		align-items: center;
		justify-content: space-between;
		gap: 0.5rem;
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
</style>

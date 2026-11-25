<!-- [bd-file:store] -->
<script lang="ts">
	/** 4, 3 or 2 stars & up; `onSelect(null)` when the chosen one is pressed again. */
	import StarRating from './StarRating.svelte';

	let {
		selected = null,
		onSelect
	}: { selected?: number | null; onSelect: (rating: number | null) => void } = $props();
</script>

<div class="store-facet">
	<p class="store-facet__title">Rating</p>
	<ul class="store-facet__list">
		{#each [4, 3, 2] as r (r)}
			{@const active = selected === r}
			<li>
				<button
					type="button"
					class="store-facet__item store-facet__rating"
					class:store-facet__item--active={active}
					onclick={() => onSelect(active ? null : r)}
				>
					<StarRating rating={r} />
					<span class="store-facet__count">&amp; up</span>
				</button>
			</li>
		{/each}
	</ul>
</div>

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
</style>

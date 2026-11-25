<!-- [bd-file:store] -->
<script lang="ts" module>
	export const SORT_LABELS: Record<string, string> = {
		featured: 'Featured',
		newest: 'Newest',
		'price-asc': 'Price: low to high',
		'price-desc': 'Price: high to low',
		'rating-desc': 'Top rated'
	};
</script>

<script lang="ts">
	/** Featured, Newest, Price either way, Top rated; `onSort` gets the new sort. */
	let { value = 'featured', onSort }: { value?: string; onSort: (sort: string) => void } = $props();
</script>

<label class="store-sort">
	<span>Sort</span>
	<select class="bd-select" {value} onchange={(e) => onSort(e.currentTarget.value)}>
		{#each Object.entries(SORT_LABELS) as [sort, label] (sort)}
			<option value={sort}>{label}</option>
		{/each}
	</select>
</label>

<style>
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
</style>

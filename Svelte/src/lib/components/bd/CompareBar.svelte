<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * Pinned to the bottom of the store while products are picked for the
	 * compare table: what's picked, and the way to the table.
	 */
	import { onMount } from 'svelte';
	import { compareList, type SavedProduct } from '#lib/bd/shop.ts';

	let items = $state<SavedProduct[]>([]);

	onMount(() => {
		items = compareList.read();
		return compareList.subscribe((next) => (items = next));
	});
</script>

{#if items.length > 0}
	<aside class="compare-bar" aria-label="Products to compare">
		<ul class="compare-bar__items">
			{#each items as item (item.id)}
				<li>
					{#if item.image}<img src={item.image} alt="" referrerpolicy="no-referrer" />{/if}
					<span>{item.name}</span>
					<button
						type="button"
						aria-label={`Remove ${item.name} from compare`}
						onclick={() => compareList.remove(item.id)}>×</button
					>
				</li>
			{/each}
		</ul>
		<div class="compare-bar__actions">
			<button type="button" class="bd-btn bd-btn--ghost" onclick={() => compareList.clear()}>
				Clear
			</button>
			<a
				class="bd-btn"
				href={`/store/compare?ids=${items.map((i) => i.id).join(',')}`}
				aria-disabled={items.length < 2}
			>
				{items.length < 2 ? 'Pick one more to compare' : `Compare ${items.length}`}
			</a>
		</div>
	</aside>
{/if}

<style>
	.compare-bar {
		position: sticky;
		bottom: 1rem;
		z-index: 20;
		display: flex;
		flex-wrap: wrap;
		align-items: center;
		justify-content: space-between;
		gap: 0.75rem;
		max-width: 72rem;
		margin: 2rem auto 0;
		padding: 0.75rem 1rem;
		border: 1px solid var(--border-strong);
		border-radius: 1rem;
		background: var(--glass-card);
		backdrop-filter: blur(12px);
		box-shadow: 0 12px 32px var(--card-neu-shadow);
	}
	.compare-bar__items {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.compare-bar__items li {
		display: flex;
		align-items: center;
		gap: 0.4rem;
		padding: 0.25rem 0.4rem 0.25rem 0.25rem;
		border: 1px solid var(--border);
		border-radius: 9999px;
		background: var(--card);
		font-size: 0.82rem;
		color: var(--title);
	}
	.compare-bar__items img {
		width: 1.6rem;
		height: 1.6rem;
		border-radius: 9999px;
		object-fit: cover;
	}
	.compare-bar__items button {
		border: none;
		background: none;
		color: var(--text-muted);
		font-size: 1rem;
		cursor: pointer;
	}
	.compare-bar__actions {
		display: flex;
		gap: 0.5rem;
	}
	.compare-bar__actions a[aria-disabled='true'] {
		pointer-events: none;
		opacity: 0.55;
	}
</style>

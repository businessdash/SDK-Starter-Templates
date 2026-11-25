<!-- [bd-file:store] -->
<script lang="ts">
	/** Five stars, filled to `rating` (halves shown). */
	let { rating }: { rating: number } = $props();
</script>

<span class="stars" role="img" aria-label={`${rating.toFixed(1)} out of 5`}>
	{#each [0, 1, 2, 3, 4] as i (i)}
		{@const filled = rating >= i + 1}
		{@const half = !filled && rating >= i + 0.5}
		<span class="stars__star" class:stars__star--on={filled} class:stars__star--half={half}>★</span>
	{/each}
</span>

<style>
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
</style>

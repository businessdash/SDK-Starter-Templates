<!-- [bd-file:store] -->
<script lang="ts">
	/** Lowest and highest price in dollars, with Apply; `range` is what the store's products cost. */
	let {
		min = null,
		max = null,
		range,
		onApply
	}: {
		min?: number | null;
		max?: number | null;
		range: { minDollars: number; maxDollars: number };
		onApply: (min: string, max: string) => void;
	} = $props();

	function submit(e: SubmitEvent) {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		onApply(String(fd.get('min') ?? '').trim(), String(fd.get('max') ?? '').trim());
	}
</script>

<form class="store-facet" onsubmit={submit}>
	<p class="store-facet__title">Price</p>
	<div class="store-price">
		<input
			class="bd-input"
			inputmode="numeric"
			name="min"
			placeholder={`$${range.minDollars}`}
			value={min ?? ''}
		/>
		<span class="store-price__sep">–</span>
		<input
			class="bd-input"
			inputmode="numeric"
			name="max"
			placeholder={`$${range.maxDollars}`}
			value={max ?? ''}
		/>
	</div>
	<button type="submit" class="bd-btn bd-btn--ghost store-price__apply"> Apply </button>
</form>

<style>
	.store-facet__title {
		font-size: 0.78rem;
		font-weight: 700;
		letter-spacing: 0.1em;
		text-transform: uppercase;
		color: var(--subtitle);
		margin-bottom: 0.75rem;
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
</style>

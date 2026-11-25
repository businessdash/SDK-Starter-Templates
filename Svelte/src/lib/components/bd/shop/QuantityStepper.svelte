<!-- [bd-file:store] -->
<script lang="ts">
	/** − and + around how many to add (`quantity`, bindable), from 1 up to what's in stock. */
	let { quantity = $bindable(1), max }: { quantity?: number; max: number | null | undefined } =
		$props();
</script>

<div class="qty" role="group" aria-label="Quantity">
	<button
		type="button"
		aria-label="One fewer"
		disabled={quantity <= 1}
		onclick={() => (quantity = Math.max(1, quantity - 1))}>−</button
	>
	<span aria-live="polite">{quantity}</span>
	<button
		type="button"
		aria-label="One more"
		disabled={max != null && quantity >= max}
		onclick={() => (quantity = Math.min(999, quantity + 1))}>+</button
	>
</div>

<style>
	.qty {
		display: inline-flex;
		align-items: center;
		border: 1px solid var(--border-strong);
		border-radius: 9999px;
	}
	.qty button {
		width: 2.5rem;
		height: 100%;
		min-height: 2.75rem;
		border: none;
		background: none;
		color: var(--title);
		font-size: 1.1rem;
		cursor: pointer;
	}
	.qty button:disabled {
		opacity: 0.35;
		cursor: not-allowed;
	}
	.qty span {
		min-width: 1.75rem;
		text-align: center;
		font-weight: 600;
		color: var(--title);
	}
</style>

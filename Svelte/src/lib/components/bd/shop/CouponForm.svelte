<!-- [bd-file:store] -->
<script lang="ts">
	/** The applied coupon with Remove, or a code box with Apply. */
	let {
		code = null,
		busy = false,
		onApply,
		onRemove
	}: {
		code?: string | null;
		busy?: boolean;
		onApply: (code: string) => void;
		onRemove: () => void;
	} = $props();

	let typed = $state('');
</script>

<div class="cart-coupon">
	{#if code}
		<span class="bd-badge">Coupon: {code}</span>
		<button class="bd-btn bd-btn--ghost" onclick={onRemove} disabled={busy}> Remove coupon </button>
	{:else}
		<input
			class="bd-input"
			placeholder="Coupon code"
			bind:value={typed}
			style="max-width: 12rem;"
		/>
		<button
			class="bd-btn bd-btn--ghost"
			onclick={() => typed && onApply(typed)}
			disabled={busy || !typed}
		>
			Apply
		</button>
	{/if}
</div>

<style>
	.cart-coupon {
		display: flex;
		align-items: center;
		gap: 0.75rem;
		flex-wrap: wrap;
	}
</style>

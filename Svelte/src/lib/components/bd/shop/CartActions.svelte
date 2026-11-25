<!-- [bd-file:store] -->
<script lang="ts">
	/** Clear cart, and Checkout ("Working…" on the way to Stripe). */
	let {
		busy = false,
		onClear,
		onCheckout
	}: { busy?: boolean; onClear: () => void; onCheckout: () => void } = $props();
</script>

<div class="cart-actions">
	<button class="bd-btn bd-btn--ghost" onclick={onClear} disabled={busy}> Clear cart </button>
	<button class="bd-btn" onclick={onCheckout} disabled={busy}>
		{busy ? 'Working…' : 'Checkout'}
	</button>
</div>

<style>
	.cart-actions {
		display: flex;
		justify-content: flex-end;
		gap: 0.75rem;
	}
</style>

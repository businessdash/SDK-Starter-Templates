<!-- [bd-file:store] -->
<script lang="ts">
	/** Secure checkout, and a link to ask before buying. */
	let { contactHref = '/#contact' }: { contactHref?: string } = $props();
</script>

<ul class="policies">
	<li>Secure checkout with Stripe</li>
	<li>Questions? <a href={contactHref}>Ask us</a> before you buy</li>
</ul>

<style>
	.policies {
		margin: 0;
		padding: 1rem 0 0;
		border-top: 1px solid var(--border);
		list-style: none;
		display: grid;
		gap: 0.35rem;
		color: var(--text-muted);
		font-size: 0.85rem;
	}
</style>

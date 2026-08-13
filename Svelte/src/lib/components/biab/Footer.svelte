<script lang="ts">
	import Subscribe from '$lib/components/biab/Subscribe.svelte';
</script>

<footer class="app-footer">
	<div class="app-footer__meta">
		<div>© {new Date().getFullYear()} Your Business. All rights reserved.</div>
		<div>
			Built with
			<a href="https://github.com/Gold240sx/business-in-a-box">@businessdash/sdk</a>
		</div>
	</div>
	<div class="app-footer__subscribe">
		<Subscribe
			source="footer"
			idPrefix="footer-subscribe"
			label="Get updates in your inbox"
			buttonLabel="Subscribe"
		/>
	</div>
</footer>

<style>
	.app-footer__meta {
		display: flex;
		flex-direction: column;
		gap: 0.35rem;
	}
	.app-footer__subscribe {
		flex: 1;
		min-width: 16rem;
		display: flex;
		justify-content: flex-end;
	}
</style>

<script setup lang="ts">
import Subscribe from "~/components/biab/Subscribe.vue";
</script>

<template>
	<footer class="app-footer">
		<div class="app-footer__meta">
			<div>© {{ new Date().getFullYear() }} Your Business. All rights reserved.</div>
			<div>
				Built with
				<a href="https://github.com/Gold240sx/business-in-a-box">@businessdash/sdk</a>
			</div>
		</div>
		<!-- Same Subscribe component the About section uses. -->
		<Subscribe
			button-label="Subscribe"
			id-prefix="footer-subscribe"
			label="Get updates in your inbox"
			source="footer"
		/>
	</footer>
</template>

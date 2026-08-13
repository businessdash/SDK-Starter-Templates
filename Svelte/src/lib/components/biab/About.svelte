<script lang="ts">
	import Subscribe from '$lib/components/biab/Subscribe.svelte';

	let { body }: { body: string } = $props();
</script>

<section class="biab-section biab-section--narrow" id="about">
	<div class="biab-section__lead">
		<span class="biab-section__eyebrow">About</span>
		<h2 class="biab-section__title">Built around how you actually work.</h2>
	</div>
	<p style="color: var(--text); font-size: 1.05rem; text-align: center;">
		{body}
	</p>
	<div class="about__subscribe">
		<Subscribe
			source="about"
			idPrefix="about-subscribe"
			label="Stay in the loop"
			buttonLabel="Subscribe"
		/>
	</div>
</section>

<style>
	.about__subscribe {
		display: flex;
		justify-content: center;
		margin-top: 2rem;
	}
</style>

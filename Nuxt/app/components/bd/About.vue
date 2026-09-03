<script setup lang="ts">
import Subscribe from "~/components/bd/Subscribe.vue";

defineProps<{ body: string }>();
</script>

<template>
	<section class="bd-section bd-section--narrow" id="about">
		<div class="bd-section__lead">
			<span class="bd-section__eyebrow">About</span>
			<h2 class="bd-section__title">Built around how you actually work.</h2>
		</div>
		<p style="color: var(--text); font-size: 1.05rem; text-align: center;">
			{{ body }}
		</p>
		<!-- Same Subscribe component the footer uses. -->
		<div class="about__subscribe">
			<Subscribe
				button-label="Subscribe"
				id-prefix="about-subscribe"
				label="Like what you see? Get updates."
				source="about"
			/>
		</div>
	</section>
</template>

<style scoped>
.about__subscribe {
	margin-top: 2rem;
	display: flex;
	justify-content: center;
}
</style>

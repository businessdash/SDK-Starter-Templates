<script setup lang="ts">
/**
 * The 404 body.
 *
 * Deliberately static — no BusinessDash call, no data fetch, nothing that can
 * fail. This renders while something else is broken, so it must not depend on
 * the thing that is broken.
 */
</script>

<template>
	<main class="biab-section biab-section--narrow">
		<div class="biab-section__lead">
			<span class="biab-section__eyebrow">404</span>
			<h1 class="biab-section__title">We couldn’t find that page</h1>
			<p class="biab-section__sub">
				The link may be out of date, or the page may have moved.
			</p>
		</div>
		<p><NuxtLink to="/">Back to the homepage</NuxtLink></p>
	</main>
</template>

<script setup lang="ts">
import BiabHeader from "~/components/biab/BiabHeader.vue";
import BiabFooter from "~/components/biab/BiabFooter.vue";
import NotFoundBody from "~/components/biab/NotFoundBody.vue";

/**
 * The catch-all — legal pages, and everything else's 404.
 *
 * ## Your own pages always win
 *
 * Nuxt resolves a static route before a catch-all, so `pages/privacy.vue`
 * shadows this file entirely. Write your own privacy policy and this is never
 * consulted for that path — no config, no conflict, no build error, nothing to
 * delete. That is why the SDK hands you a resolver rather than generating
 * `pages/privacy.vue`: two files claiming one route is a build failure, which
 * would turn "I wrote my own policy" into a broken deploy.
 */
const route = useRoute();
const slug = computed(() => {
	const raw = route.params.slug;
	return Array.isArray(raw) ? raw.join("/") : (raw ?? "");
});

const { data } = await useFetch("/api/biab/legal", {
	query: { slug },
});

// A real 404 status, so crawlers and uptime checks see the truth rather than
// a 200 with an apology on it.
if (!data.value?.found) {
	setResponseStatus(useRequestEvent()!, 404);
}

useHead(() => ({
	title: data.value?.found ? data.value.title : "Page not found",
}));
</script>

<template>
	<BiabHeader />
	<!--
		`html` is sanitised server-side when the org saves it, and the title and
		logo URL are escaped by `renderLegalPageHtml`. Style it via the
		`data-biab-legal-*` hooks — the markup ships unstyled so it inherits
		your site rather than fighting it.
	-->
	<main v-if="data?.found" class="biab-section biab-section--narrow">
		<div v-html="data.html" />
	</main>
	<NotFoundBody v-else />
	<BiabFooter />
</template>

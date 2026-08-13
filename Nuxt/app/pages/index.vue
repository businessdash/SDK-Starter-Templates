<script setup lang="ts">
import About from "~/components/biab/About.vue";
import BiabFooter from "~/components/biab/BiabFooter.vue";
import BiabHeader from "~/components/biab/BiabHeader.vue";
import Blog from "~/components/biab/Blog.vue";
import Booking from "~/components/biab/Booking.vue";
import ContactForm from "~/components/biab/ContactForm.vue";
import Gallery from "~/components/biab/Gallery.vue";
import Hero from "~/components/biab/Hero.vue";
import NewsBanner from "~/components/biab/NewsBanner.vue";
import Services from "~/components/biab/Services.vue";

import type { HomeData } from "../../server/api/biab/home.get";

/**
 * `useFetch` runs `/api/biab/home` on the server during SSR. The
 * Nitro endpoint calls every SDK method in parallel; the page
 * renders with the data already resolved — no spinners, no
 * client-side re-fetch on hydration. The bearer key never enters
 * the browser bundle because it only exists in `server/utils/biab.ts`.
 */
const { data } = await useFetch<HomeData>("/api/biab/home");

// JSON-LD (LocalBusiness + WebSite) built server-side from the SDK's SEO
// builders and injected into the head, so crawlers see structured data.
const { data: jsonld } = await useFetch<{ html: string }>("/api/biab/jsonld");

useHead({
	title: "Your Business — built on BIAB",
	meta: [
		{
			name: "description",
			content:
				"Nuxt 4 starter showing how to consume the BIAB SDK from a server-only utility, with Nitro endpoints for interactive surfaces.",
		},
	],
	script: jsonld.value?.html
		? [{ type: "application/ld+json", innerHTML: jsonld.value.html }]
		: [],
});
</script>

<template>
	<div v-if="data">
		<NewsBanner :messages="data.banner" />
		<BiabHeader />
		<main>
			<Hero :hero="data.hero" />
			<About :body="data.about" />
			<Services :services="data.services" />
			<Gallery :items="data.gallery" />
			<Booking :event-types="data.eventTypes" />
			<Blog :posts="data.blogPosts" />
			<ContactForm :schema="data.formSchema" :slug="data.formSlug" />
		</main>
		<BiabFooter />
	</div>
</template>

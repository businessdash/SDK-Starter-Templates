<script setup lang="ts">
import About from "~/components/bd/About.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import Blog from "~/components/bd/Blog.vue";
import Booking from "~/components/bd/Booking.vue";
import ContactForm from "~/components/bd/ContactForm.vue";
import Gallery from "~/components/bd/Gallery.vue";
import Hero from "~/components/bd/Hero.vue";
import NewsBanner from "~/components/bd/NewsBanner.vue";
import Services from "~/components/bd/Services.vue";

import type { HomeData } from "../../server/api/bd/home.get";

/**
 * `useFetch` runs `/api/bd/home` on the server during SSR. The
 * Nitro endpoint calls every SDK method in parallel; the page
 * renders with the data already resolved — no spinners, no
 * client-side re-fetch on hydration. The bearer key never enters
 * the browser bundle because it only exists in `server/utils/bd.ts`.
 */
const { data } = await useFetch<HomeData>("/api/bd/home");

// JSON-LD (LocalBusiness + WebSite) built server-side from the SDK's SEO
// builders and injected into the head, so crawlers see structured data.
const { data: jsonld } = await useFetch<{ html: string }>("/api/bd/jsonld");

useHead({
	title: "Your Business — built on BD",
	meta: [
		{
			name: "description",
			content:
				"Nuxt 4 starter showing how to consume the BD SDK from a server-only utility, with Nitro endpoints for interactive surfaces.",
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
		<BdHeader />
		<main>
			<Hero :hero="data.hero" />
			<About :body="data.about" />
			<Services :services="data.services" />
			<Gallery :items="data.gallery" />
			<Booking :event-types="data.eventTypes" />
			<Blog :posts="data.blogPosts" />
			<ContactForm :schema="data.formSchema" :slug="data.formSlug" />
		</main>
		<BdFooter />
	</div>
</template>

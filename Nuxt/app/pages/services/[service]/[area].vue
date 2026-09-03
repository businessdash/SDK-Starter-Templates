<script setup lang="ts">
import { computed } from "vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import type { ParallelRenderResult } from "../../../../server/api/bd/parallel/render.get";

/**
 * A single (service × area) parallel page, rendered server-side from
 * BD via `parallelPages.render("service-area", { service, area })`.
 * BD resolves the brand/service/area tokens, so `meta` + `body` come
 * back fully expanded — crawlers see finished HTML.
 *
 * Failure modes mirror DGP: unknown slug → 404; billing suspended → a
 * minimal "temporarily unavailable" notice with a 503 (set on the
 * server endpoint).
 */
const route = useRoute();
const service = route.params.service as string;
const area = route.params.area as string;

const { data } = await useFetch<ParallelRenderResult>(
	"/api/bd/parallel/render",
	{ query: { key: "service-area", service, area } },
);

const variant = computed(() =>
	data.value?.state === "ok" ? data.value.variant : null,
);
const suspended = computed(() => data.value?.state === "suspended");

// Loose-shaped body (BD template output). Pull the common fields.
const body = computed(
	() =>
		(variant.value?.body as
			| { PageTitle?: string; PageHeadline?: string }
			| null
			| undefined) ?? null,
);

// Surface a real 404 status for unknown variants (good for SEO).
if (data.value?.state === "not-found") {
	throw createError({ statusCode: 404, statusMessage: "Page not found" });
}

useHead(() => {
	const meta = variant.value?.meta;
	if (!meta) return { title: "Service area" };
	return {
		title: meta.title,
		meta: [{ name: "description", content: meta.description }],
		link: meta.canonical ? [{ rel: "canonical", href: meta.canonical }] : [],
	};
});
</script>

<template>
	<div>
		<BdHeader />
		<main>
			<section class="bd-section bd-section--narrow">
				<div v-if="suspended" class="bd-empty">
					This page is temporarily unavailable. Please check back soon.
				</div>
				<template v-else-if="variant">
					<div class="bd-section__lead" style="text-align: left">
						<h1 class="bd-section__title">
							{{ variant.meta.title.split(" | ")[0] }}
						</h1>
						<p class="bd-section__sub" style="margin: 0">
							{{ variant.meta.description }}
						</p>
					</div>
					<div v-if="body?.PageTitle" class="bd-card service-area-body">
						<h2>{{ body.PageTitle }}</h2>
						<p v-if="body.PageHeadline">{{ body.PageHeadline }}</p>
					</div>
					<p class="store-links">
						<NuxtLink to="/services">← All service areas</NuxtLink>
					</p>
				</template>
			</section>
		</main>
		<BdFooter />
	</div>
</template>

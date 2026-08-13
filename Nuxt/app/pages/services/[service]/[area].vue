<script setup lang="ts">
import { computed } from "vue";
import BiabHeader from "~/components/biab/BiabHeader.vue";
import BiabFooter from "~/components/biab/BiabFooter.vue";
import type { ParallelRenderResult } from "../../../../server/api/biab/parallel/render.get";

/**
 * A single (service × area) parallel page, rendered server-side from
 * BIAB via `parallelPages.render("service-area", { service, area })`.
 * BIAB resolves the brand/service/area tokens, so `meta` + `body` come
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
	"/api/biab/parallel/render",
	{ query: { key: "service-area", service, area } },
);

const variant = computed(() =>
	data.value?.state === "ok" ? data.value.variant : null,
);
const suspended = computed(() => data.value?.state === "suspended");

// Loose-shaped body (BIAB template output). Pull the common fields.
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
		<BiabHeader />
		<main>
			<section class="biab-section biab-section--narrow">
				<div v-if="suspended" class="biab-empty">
					This page is temporarily unavailable. Please check back soon.
				</div>
				<template v-else-if="variant">
					<div class="biab-section__lead" style="text-align: left">
						<h1 class="biab-section__title">
							{{ variant.meta.title.split(" | ")[0] }}
						</h1>
						<p class="biab-section__sub" style="margin: 0">
							{{ variant.meta.description }}
						</p>
					</div>
					<div v-if="body?.PageTitle" class="biab-card service-area-body">
						<h2>{{ body.PageTitle }}</h2>
						<p v-if="body.PageHeadline">{{ body.PageHeadline }}</p>
					</div>
					<p class="store-links">
						<NuxtLink to="/services">← All service areas</NuxtLink>
					</p>
				</template>
			</section>
		</main>
		<BiabFooter />
	</div>
</template>

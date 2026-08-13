<script setup lang="ts">
import BiabHeader from "~/components/biab/BiabHeader.vue";
import BiabFooter from "~/components/biab/BiabFooter.vue";
import type { ParallelVariantsResult } from "../../../server/api/biab/parallel/variants.get";

/**
 * Service-area index. Lists every materialised (service × area) variant
 * of the `service-area` parallel page declared in `biab.config.ts`, and
 * links to its SSR-rendered detail route at
 * `/services/[service]/[area]`. The variants come from
 * `parallelPages.listVariants("service-area")`.
 */
const { data } = await useFetch<ParallelVariantsResult>(
	"/api/biab/parallel/variants",
	{ query: { key: "service-area" } },
);

function variantLabel(v: Record<string, string>): string {
	const service = v.service ?? "";
	const area = v.area ?? "";
	const human = (s: string) => s.replace(/-/g, " ");
	return area ? `${human(service)} in ${human(area)}` : human(service);
}

useHead({ title: "Service areas — Your Business" });
</script>

<template>
	<div>
		<BiabHeader />
		<main>
			<section class="biab-section">
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Coverage</span>
					<h1 class="biab-section__title">Service areas</h1>
					<p class="biab-section__sub">
						Programmatic SEO pages — one URL per service × area, rendered
						server-side from BIAB with fully-resolved meta + body.
					</p>
				</div>

				<div v-if="!data || data.variants.length === 0" class="biab-empty">
					No service-area pages yet. Add services and service areas in BIAB, then
					publish — they fan out into pages here.
				</div>
				<ul v-else class="services-index">
					<li v-for="v in data.variants" :key="`${v.service}/${v.area}`">
						<NuxtLink :to="`/services/${v.service}/${v.area}`">
							{{ variantLabel(v) }}
						</NuxtLink>
					</li>
				</ul>
			</section>
		</main>
		<BiabFooter />
	</div>
</template>

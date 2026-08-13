<script setup lang="ts">
import BiabHeader from "~/components/biab/BiabHeader.vue";
import BiabFooter from "~/components/biab/BiabFooter.vue";
import type { HomeData } from "../../server/api/biab/home.get";

/**
 * News & updates feed. Renders `bundle.updates` (Google-Business-style
 * posts) carried on the marketing bundle and surfaced by the home
 * aggregator. Degrades to an empty state when there are none.
 */
const { data } = await useFetch<HomeData>("/api/biab/home");

function formatDate(iso: string | null | undefined): string {
	if (!iso) return "";
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? ""
		: d.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			});
}

useHead({ title: "Updates — Your Business" });
</script>

<template>
	<div>
		<BiabHeader />
		<main>
			<section class="biab-section biab-section--narrow">
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">News</span>
					<h1 class="biab-section__title">Updates</h1>
					<p class="biab-section__sub">
						The latest from us — synced from your Google Business posts.
					</p>
				</div>

				<div v-if="!data || data.updates.length === 0" class="biab-empty">
					No updates yet. Posts you publish to your Google Business profile show
					up here.
				</div>
				<div v-else class="updates-feed">
					<article
						v-for="update in data.updates"
						:key="update.id"
						class="biab-card update-card"
					>
						<img
							v-if="update.imageUrl"
							:alt="update.title ?? 'Update'"
							class="update-card__img"
							:src="update.imageUrl"
						/>
						<div class="update-card__body">
							<span v-if="update.postedAt" class="update-card__date">
								{{ formatDate(update.postedAt) }}
							</span>
							<h3 v-if="update.title">{{ update.title }}</h3>
							<p>{{ update.body }}</p>
							<a
								v-if="update.link"
								:href="update.link"
								rel="noopener"
								target="_blank"
							>
								Learn more →
							</a>
						</div>
					</article>
				</div>
			</section>
		</main>
		<BiabFooter />
	</div>
</template>

<script setup lang="ts">
import BiabHeader from "~/components/biab/BiabHeader.vue";
import BiabFooter from "~/components/biab/BiabFooter.vue";
import { formatMoney } from "~/composables/useCart";
import type { StoreSubscriptionsResult } from "../../server/api/biab/store/subscriptions.get";

/**
 * Subscriptions page. Lists the org's recurring-plan offerings from
 * `subscriptions.list()`. Display-only here; wiring a "subscribe" button
 * follows the same `checkout.forVisitor(...).start(...)` pattern as the
 * cart (see /api/biab/checkout/start).
 */
const { data } = await useFetch<StoreSubscriptionsResult>(
	"/api/biab/store/subscriptions",
);

function intervalLabel(interval: string): string {
	return `/ ${interval}`;
}

useHead({ title: "Subscriptions — Your Business" });
</script>

<template>
	<div>
		<BiabHeader />
		<main>
			<section class="biab-section">
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Plans</span>
					<h1 class="biab-section__title">Subscriptions</h1>
					<p class="biab-section__sub">
						Recurring plans from the BIAB subscriptions surface.
					</p>
				</div>

				<div v-if="data?.suspended" class="biab-empty">
					Subscriptions are temporarily unavailable. Please check back soon.
				</div>
				<div v-else-if="!data || data.items.length === 0" class="biab-empty">
					No subscription plans yet. Add some in BIAB at Dashboard → Products →
					Subscriptions.
				</div>
				<div v-else class="biab-grid-3">
					<article
						v-for="plan in data.items"
						:key="plan.id"
						class="biab-card plan-card"
					>
						<img
							v-if="plan.imageUrl"
							:alt="plan.name"
							class="plan-card__img"
							:src="plan.imageUrl"
						/>
						<h3>{{ plan.name }}</h3>
						<p v-if="plan.description">{{ plan.description }}</p>
						<div class="plan-card__price">
							{{ formatMoney(plan.amountCents) }}
							<span>{{ intervalLabel(plan.interval) }}</span>
						</div>
					</article>
				</div>

				<p class="store-links">
					<NuxtLink to="/store">← Back to store</NuxtLink>
				</p>
			</section>
		</main>
		<BiabFooter />
	</div>
</template>

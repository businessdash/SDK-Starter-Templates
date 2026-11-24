<!-- [bd-file:saas] -->
<script setup lang="ts">
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import { computed, ref } from "vue";
import { formatMoney } from "~/composables/useCart";
import type { StoreSubscriptionsResult } from "../../server/api/bd/store/subscriptions.get";

/**
 * Subscriptions page. Lists the org's recurring-plan offerings from
 * `subscriptions.list()`. "Subscribe" asks
 * `/api/bd/store/subscriptions/:id/checkout` for a Stripe URL, for the
 * signed-in customer; a visitor is offered sign-in first.
 */
const SIGN_IN = "/my-account?next=/subscriptions";
const { data } = await useFetch<StoreSubscriptionsResult>(
	"/api/bd/store/subscriptions",
);
const route = useRoute();
const subscribed = computed(() => typeof route.query.session_id === "string");
const busyId = ref<string | null>(null);
const error = ref<string | null>(null);

async function subscribe(id: string) {
	busyId.value = id;
	error.value = null;
	try {
		const res = await $fetch<
			{ ok: true; url: string } | { ok: false; error: string; signIn?: string }
		>(`/api/bd/store/subscriptions/${encodeURIComponent(id)}/checkout`, {
			method: "POST",
			ignoreResponseError: true,
		});
		if (res.ok) window.location.href = res.url;
		else if (res.signIn) window.location.href = res.signIn;
		else error.value = res.error;
	} catch (err) {
		error.value = err instanceof Error ? err.message : "Network error.";
	} finally {
		busyId.value = null;
	}
}

function intervalLabel(interval: string): string {
	return `/ ${interval}`;
}

useHead({ title: "Subscriptions — Your Business" });
</script>

<template>
	<div>
		<BdHeader />
		<main>
			<section class="bd-section">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Plans</span>
					<h1 class="bd-section__title">Subscriptions</h1>
					<p class="bd-section__sub">
						Recurring plans from the BD subscriptions surface.
					</p>
				</div>

				<div v-if="subscribed" class="bd-empty">
					Thanks for subscribing. Your plan is in
					<NuxtLink to="/my-account">your account</NuxtLink>.
				</div>
				<div v-if="data?.suspended" class="bd-empty">
					Subscriptions are temporarily unavailable. Please check back soon.
				</div>
				<div v-else-if="!data || data.items.length === 0" class="bd-empty">
					No subscription plans yet. Add some in BD at Dashboard → Products →
					Subscriptions.
				</div>
				<div v-else class="bd-grid-3">
					<article
						v-for="plan in data.items"
						:key="plan.id"
						class="bd-card plan-card"
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
						<button
							v-if="data.signedIn"
							class="bd-btn"
							type="button"
							:disabled="busyId === plan.id"
							@click="subscribe(plan.id)"
						>
							{{ busyId === plan.id ? "Working…" : "Subscribe" }}
						</button>
						<a v-else class="bd-btn" :href="SIGN_IN">Sign in to subscribe</a>
					</article>
				</div>

				<div v-if="error" class="plan-error">{{ error }}</div>

				<!-- [bd:store] -->
				<p class="store-links">
					<NuxtLink to="/store">← Back to store</NuxtLink>
				</p>
				<!-- [/bd:store] -->
			</section>
		</main>
		<BdFooter />
	</div>
</template>

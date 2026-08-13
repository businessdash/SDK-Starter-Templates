<script setup lang="ts">
import { ref } from "vue";

/**
 * Customer review form. Posts to `/api/biab/portal/submit-review`,
 * which validates and submits the review as the signed-in customer via
 * the BIAB customer portal. The review lands as `pending` until staff
 * moderates it. Only useful when the visitor is signed in — the page
 * gates rendering on session presence.
 */
const rating = ref(5);
const title = ref("");
const body = ref("");
const submitting = ref(false);
const success = ref<string | null>(null);
const error = ref<string | null>(null);

async function handleSubmit() {
	submitting.value = true;
	success.value = null;
	error.value = null;
	try {
		const res = await $fetch<{ ok: boolean; status: string }>(
			"/api/biab/portal/submit-review",
			{
				method: "POST",
				body: { rating: rating.value, title: title.value, body: body.value },
			},
		);
		success.value =
			"Thanks! Your review was submitted and will appear once it's approved.";
		void res;
		title.value = "";
		body.value = "";
		rating.value = 5;
	} catch (err) {
		const message =
			(err as { statusMessage?: string })?.statusMessage ??
			(err instanceof Error ? err.message : "Couldn't submit your review.");
		error.value = message;
	} finally {
		submitting.value = false;
	}
}
</script>

<template>
	<form class="biab-card review-form" @submit.prevent="handleSubmit">
		<h3>Leave a review</h3>

		<div>
			<label class="biab-label" for="review-rating">Rating</label>
			<select id="review-rating" v-model.number="rating" class="biab-select">
				<option v-for="n in 5" :key="n" :value="6 - n">
					{{ "★".repeat(6 - n) }} ({{ 6 - n }})
				</option>
			</select>
		</div>

		<div>
			<label class="biab-label" for="review-title">Title (optional)</label>
			<input
				id="review-title"
				v-model="title"
				class="biab-input"
				maxlength="200"
				placeholder="Great service"
			/>
		</div>

		<div>
			<label class="biab-label" for="review-body">Your review</label>
			<textarea
				id="review-body"
				v-model="body"
				class="biab-textarea"
				maxlength="5000"
				placeholder="Tell us how it went…"
				required
			></textarea>
		</div>

		<button
			class="biab-btn"
			:disabled="submitting || !body.trim()"
			style="align-self: flex-start"
			type="submit"
		>
			{{ submitting ? "Submitting…" : "Submit review" }}
		</button>

		<p v-if="success" class="review-form__success">{{ success }}</p>
		<div
			v-if="error"
			style="
				color: var(--danger);
				background: var(--danger-bg);
				padding: 0.75rem 1rem;
				border-radius: 0.5rem;
				font-size: 0.9rem;
			"
		>
			{{ error }}
		</div>
	</form>
</template>

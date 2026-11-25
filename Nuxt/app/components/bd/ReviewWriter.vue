<script setup lang="ts">
import { nextTick, ref } from "vue";
import { checkReview, REVIEW_MAX_LENGTH, REVIEW_SENT } from "#shared/bd/reviews";

/**
 * A signed-in customer writes a review of the business; it waits for the
 * business to approve it. Signed out, it's a link to sign in. Posts to
 * `/api/bd/reviews/write`, which checks it again.
 */
const props = defineProps<{ signedIn: boolean; signInHref: string }>();

const open = ref(false);
const rating = ref(0);
const title = ref("");
const body = ref("");
const sending = ref(false);
const sent = ref(false);
const error = ref("");
const signedOut = ref(!props.signedIn);
const form = ref<HTMLFormElement | null>(null);

async function start() {
	open.value = true;
	await nextTick();
	form.value?.querySelector<HTMLButtonElement>(".review-writer__star")?.focus();
}

function choose(star: number) {
	rating.value = star;
	error.value = "";
}

async function send() {
	if (sending.value) return;
	const checked = checkReview({ rating: rating.value, title: title.value, body: body.value });
	if (!checked.ok) {
		error.value = checked.error;
		return;
	}
	sending.value = true;
	error.value = "";
	try {
		await $fetch("/api/bd/reviews/write", { method: "POST", body: checked.review });
		sent.value = true;
	} catch (err) {
		const status = (err as { statusCode?: number })?.statusCode;
		const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage;
		if (status === 401) signedOut.value = true;
		else error.value = message || "Couldn't send your review. Try again.";
	} finally {
		sending.value = false;
	}
}
</script>

<template>
	<p v-if="sent" class="review-writer__sent" role="status">{{ REVIEW_SENT }}</p>
	<a v-else-if="signedOut" class="bd-btn bd-btn--ghost" :href="props.signInHref">Sign in to write a review</a>
	<button v-else-if="!open" class="bd-btn" type="button" @click="start">Write a review</button>
	<form v-else ref="form" class="review-writer" @submit.prevent="send">
		<fieldset class="review-writer__stars">
			<legend class="bd-label">Your rating</legend>
			<button
				v-for="star in 5"
				:key="star"
				:class="['review-writer__star', { 'is-on': star <= rating }]"
				type="button"
				:aria-label="`${star} ${star === 1 ? 'star' : 'stars'}`"
				:aria-pressed="rating === star"
				@click="choose(star)"
			>
				{{ star <= rating ? "★" : "☆" }}
			</button>
		</fieldset>
		<label class="bd-label" for="review-title">Title (optional)</label>
		<input id="review-title" v-model="title" class="bd-input" maxlength="200" />
		<label class="bd-label" for="review-body">Your review</label>
		<textarea
			id="review-body"
			v-model="body"
			class="bd-textarea"
			:maxlength="REVIEW_MAX_LENGTH"
			required
			rows="5"
		/>
		<button class="bd-btn" type="submit" :disabled="sending">{{ sending ? "Sending…" : "Send review" }}</button>
		<p v-if="error" class="review-writer__error" role="alert">{{ error }}</p>
	</form>
</template>

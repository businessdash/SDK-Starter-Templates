<!-- [bd-file:blog] -->
<script setup lang="ts">
/**
 * Add a comment, posted to `commentUrl`; once it's in, `refresh` reloads
 * the list (the button waits for it). Signed out, a link to sign in.
 */
import { ref } from "vue";

const props = defineProps<{
	signedIn: boolean;
	signInHref: string;
	commentUrl: string;
	refresh?: () => Promise<unknown>;
}>();

const draft = ref("");
const note = ref<{ kind: "ok" | "error"; text: string } | null>(null);
const posting = ref(false);

async function post() {
	const content = draft.value.trim();
	if (!content) return;
	posting.value = true;
	note.value = null;
	try {
		const res = await $fetch<{ approved: boolean }>(props.commentUrl, {
			method: "POST",
			body: { content },
		});
		draft.value = "";
		note.value = {
			kind: "ok",
			text: res.approved ? "Comment posted." : "Thanks! Your comment shows once it's approved.",
		};
		await props.refresh?.();
	} catch (err) {
		const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage;
		note.value = { kind: "error", text: message || "Couldn't post your comment. Try again." };
	} finally {
		posting.value = false;
	}
}
</script>

<template>
	<form v-if="signedIn" class="comments__form" @submit.prevent="post">
		<label class="bd-label" for="comment">Add a comment</label>
		<textarea
			id="comment"
			v-model="draft"
			name="content"
			class="bd-textarea"
			rows="4"
			maxlength="5000"
			required
		/>
		<button class="bd-btn" type="submit" :disabled="posting">
			{{ posting ? "Posting…" : "Post comment" }}
		</button>
		<p
			v-if="note"
			:class="note.kind === 'ok' ? 'comments__ok' : 'post__error'"
			:role="note.kind === 'ok' ? 'status' : 'alert'"
		>
			{{ note.text }}
		</p>
	</form>
	<p v-else class="comments__signin">
		<NuxtLink class="bd-btn bd-btn--ghost" :to="signInHref">Sign in to comment</NuxtLink>
	</p>
</template>

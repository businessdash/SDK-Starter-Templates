<!-- [bd-file:blog] -->
<script setup lang="ts">
/**
 * ♡ Like and how many likes, for a signed-in customer; it posts to
 * `likeUrl`. Signed out, it leads to sign-in.
 */
import { ref, watch } from "vue";

const props = defineProps<{
	likes: { liked: boolean; likesCount: number };
	signedIn: boolean;
	signInHref: string;
	likeUrl: string;
}>();

const current = ref(props.likes);
watch(
	() => props.likes,
	(next) => {
		current.value = next;
	},
);
const error = ref("");

async function toggle() {
	error.value = "";
	try {
		current.value = await $fetch<{ liked: boolean; likesCount: number }>(props.likeUrl, {
			method: "POST",
		});
	} catch (err) {
		const message = (err as { data?: { statusMessage?: string } })?.data?.statusMessage;
		error.value = message || "Couldn't save your like. Try again.";
	}
}
</script>

<template>
	<div class="post__like">
		<button
			v-if="signedIn"
			type="button"
			class="like"
			:class="{ 'like--on': current.liked }"
			:aria-pressed="current.liked"
			@click="toggle"
		>
			<span aria-hidden="true">{{ current.liked ? "♥" : "♡" }}</span>
			{{ current.liked ? "Liked" : "Like" }}
		</button>
		<NuxtLink v-else class="like" :to="signInHref">
			<span aria-hidden="true">♡</span> Sign in to like
		</NuxtLink>
		<span class="post__likes">
			{{ current.likesCount }} {{ current.likesCount === 1 ? "like" : "likes" }}
		</span>
		<span v-if="error" class="post__error" role="alert">{{ error }}</span>
	</div>
</template>

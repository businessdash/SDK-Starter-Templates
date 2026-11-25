<!-- [bd-file:blog] -->
<script setup lang="ts">
/** In place of a members-only post's body: sign in to read it. */
defineProps<{ signInHref: string }>();
</script>

<template>
	<div class="bd-empty">
		This post is for members.
		<p><NuxtLink class="bd-btn" :to="signInHref">Sign in to read it</NuxtLink></p>
	</div>
</template>

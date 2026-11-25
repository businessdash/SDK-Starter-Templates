<!-- [bd-file:blog] -->
<script setup lang="ts">
/** The post's body. `html` must already be safe: the server rebuilds it from an allowlist (see `#shared/bd/blog`). */
defineProps<{ html: string }>();
</script>

<template>
	<!-- eslint-disable-next-line vue/no-v-html -->
	<div class="post__body" v-html="html" />
</template>

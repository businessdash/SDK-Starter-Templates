<!-- [bd-file:store] -->
<script setup lang="ts">
/** After adding: "Added 2 to your cart." with View cart, or what went wrong. */
withDefaults(
	defineProps<{ message: { kind: "ok" | "error"; text: string } | null; cartHref?: string }>(),
	{ cartHref: "/cart" },
);
</script>

<template>
	<div
		v-if="message"
		class="product-detail__msg"
		:class="{ 'product-detail__msg--err': message.kind === 'error' }"
		role="status"
	>
		{{ message.text }}
		<NuxtLink v-if="message.kind === 'ok'" class="bd-btn bd-btn--ghost" :to="cartHref">
			View cart
		</NuxtLink>
	</div>
</template>

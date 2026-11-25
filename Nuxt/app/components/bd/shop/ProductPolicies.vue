<!-- [bd-file:store] -->
<script setup lang="ts">
/** Secure checkout, and a link to ask before buying. */
withDefaults(defineProps<{ contactHref?: string }>(), { contactHref: "/#contact" });
</script>

<template>
	<ul class="policies">
		<li>Secure checkout with Stripe</li>
		<li>Questions? <NuxtLink :to="contactHref">Ask us</NuxtLink> before you buy</li>
	</ul>
</template>

<script setup lang="ts">
import type { HeroData } from "../../../server/api/bd/home.get";

defineProps<{ hero: HeroData }>();
</script>

<template>
	<section class="hero" id="hero">
		<span class="bd-badge">Open · Mon–Sat</span>
		<h1 class="hero__title">{{ hero.title }}</h1>
		<p class="hero__sub">{{ hero.tagline }}</p>
		<a class="bd-btn" :href="hero.ctaHref">{{ hero.ctaLabel }}</a>
	</section>
</template>

<template>
	<header class="app-header">
		<div class="app-header__inner">
			<NuxtLink class="app-header__brand" to="/">Your Business</NuxtLink>
			<nav>
				<!-- [bd:store] -->
				<NuxtLink to="/store">Store</NuxtLink>
				<!-- [/bd:store] -->
				<!-- [bd:subscriptions] -->
				<!-- [bd:!store] -->
				<NuxtLink to="/subscriptions">Plans</NuxtLink>
				<!-- [/bd:!store] -->
				<!-- [/bd:subscriptions] -->
				<!-- [bd:blog] -->
				<NuxtLink to="/blog">Blog</NuxtLink>
				<!-- [/bd:blog] -->
				<NuxtLink to="/services">Service areas</NuxtLink>
				<NuxtLink to="/reviews">Reviews</NuxtLink>
				<NuxtLink to="/updates">Updates</NuxtLink>
				<NuxtLink to="/todos">Todos</NuxtLink>
				<!-- [bd:store] -->
				<NuxtLink to="/cart">Cart</NuxtLink>
				<!-- [/bd:store] -->
				<NuxtLink to="/my-account">Account</NuxtLink>
			</nav>
		</div>
	</header>
</template>

<style scoped>
/* Narrow screens: the links get their own row and scroll sideways, so the
   header never runs wider than the screen. */
@media (max-width: 860px) {
	.app-header__inner {
		flex-wrap: wrap;
		row-gap: 0.6rem;
	}
	nav {
		order: 3;
		flex: 1 0 100%;
		min-width: 0;
		overflow-x: auto;
		white-space: nowrap;
		scrollbar-width: none;
	}
}
</style>

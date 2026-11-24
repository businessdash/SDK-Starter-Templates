<template>
	<header class="app-header">
		<div class="app-header__inner">
			<NuxtLink class="app-header__brand" to="/">Your Business</NuxtLink>
			<nav>
				<!-- [bd:store] -->
				<NuxtLink to="/store">Store</NuxtLink>
				<!-- [/bd:store] -->
				<!-- [bd:saas] -->
				<!-- [bd:!store] -->
				<NuxtLink to="/subscriptions">Plans</NuxtLink>
				<!-- [/bd:!store] -->
				<!-- [/bd:saas] -->
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

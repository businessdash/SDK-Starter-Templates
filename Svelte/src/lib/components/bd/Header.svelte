<header class="app-header">
	<div class="app-header__inner">
		<a class="app-header__brand" href="/">Your Business</a>
		<nav>
			<a href="/#services">Services</a>
			<!-- [bd:store] -->
			<a href="/store">Store</a>
			<!-- [/bd:store] -->
			<!-- [bd:subscriptions] -->
			<!-- [bd:!store] -->
			<a href="/store/subscriptions">Plans</a>
			<!-- [/bd:!store] -->
			<!-- [/bd:subscriptions] -->
			<!-- [bd:blog] -->
			<a href="/blog">Blog</a>
			<!-- [/bd:blog] -->
			<a href="/reviews">Reviews</a>
			<a href="/updates">Updates</a>
			<a href="/todos">Todos</a>
			<a href="/#contact">Contact</a>
		</nav>
		<div class="app-header__account">
			<!--
				`/my-account` reads the session server-side and shows the sign-in
				screen when signed out, so the header links stay simple.
			-->
			<a class="bd-btn bd-btn--ghost app-header__signin" href="/my-account">
				Sign in
			</a>
			<a class="bd-btn app-header__account-btn" href="/my-account">My account</a>
		</div>
	</div>
</header>

<style>
	.app-header__brand {
		border-bottom: none;
	}
	.app-header__account {
		display: flex;
		align-items: center;
		gap: 0.6rem;
	}
	.app-header__account a {
		border-bottom: none;
		font-size: 0.82rem;
		padding: 0.4rem 0.85rem;
	}
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
	@media (max-width: 640px) {
		.app-header__signin {
			display: none;
		}
	}
</style>

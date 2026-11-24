<header class="app-header">
	<div class="app-header__inner">
		<a class="app-header__brand" href="/">Your Business</a>
		<nav>
			<a href="/#services">Services</a>
			<a href="/store">Store</a>
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
	@media (max-width: 640px) {
		.app-header__signin {
			display: none;
		}
	}
</style>

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
				Plain links work for any stack: the `/api/biab-auth/*` handler
				owns the WorkOS redirect dance and the `biab_session` cookie.
				`/my-account` reads the session server-side and shows sign-in
				when signed out, so we keep the header link simple.
			-->
			<a class="biab-btn biab-btn--ghost app-header__signin" href="/api/biab-auth/sign-in">
				Sign in
			</a>
			<a class="biab-btn app-header__account-btn" href="/my-account">My account</a>
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

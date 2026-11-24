export function BdHeader() {
	return (
		<header class="app-header">
			<div class="app-header__inner">
				<a class="app-header__brand" href="/" style="border-bottom: none;">
					Your Business
				</a>
				<nav>
					<a href="/#services">Services</a>
					<a href="/#gallery">Gallery</a>
					<a href="/#booking">Book</a>
					{/* [bd:store] */}
					<a href="/store">Store</a>
					{/* [/bd:store] */}
					{/* [bd:saas] */}
					<a href="/subscriptions">Plans</a>
					{/* [/bd:saas] */}
					<a href="/reviews">Reviews</a>
					<a href="/updates">Updates</a>
					<a href="/my-account">Account</a>
				</nav>
			</div>
		</header>
	);
}

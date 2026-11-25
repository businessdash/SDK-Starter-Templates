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
					{/* [bd:booking] */}
					<a href="/#booking">Book</a>
					{/* [/bd:booking] */}
					{/* [bd:store] */}
					<a href="/store">Store</a>
					{/* [/bd:store] */}
					{/* [bd:subscriptions] */}
					{/* [bd:!store] */}
					<a href="/subscriptions">Plans</a>
					{/* [/bd:!store] */}
					{/* [/bd:subscriptions] */}
					{/* [bd:blog] */}
					<a href="/blog">Blog</a>
					{/* [/bd:blog] */}
					<a href="/reviews">Reviews</a>
					<a href="/updates">Updates</a>
					<a href="/my-account">Account</a>
				</nav>
			</div>
		</header>
	);
}

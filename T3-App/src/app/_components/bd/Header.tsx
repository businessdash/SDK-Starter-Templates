import { HeaderAuth } from "@/app/_components/bd/AuthButtons";

export function BdHeader() {
	return (
		<header className="app-header">
			<div className="app-header__inner">
				<a className="app-header__brand" href="/">
					Your Business
				</a>
				{/* The links start with "/" so they work from every page. */}
				<nav>
					<a href="/#services">Services</a>
					<a href="/#gallery">Gallery</a>
					{/* [bd:booking] */}
					<a href="/#booking">Book</a>
					{/* [/bd:booking] */}
					<a href="/reviews">Reviews</a>
					{/* [bd:store] */}
					<a href="/store">Store</a>
					{/* [/bd:store] */}
					{/* [bd:subscriptions] */}
					{/* [bd:!store] */}
					<a href="/store/subscriptions">Plans</a>
					{/* [/bd:!store] */}
					{/* [/bd:subscriptions] */}
					{/* [bd:blog] */}
					<a href="/blog">Blog</a>
					{/* [/bd:blog] */}
					<a href="/#contact">Contact</a>
					<HeaderAuth />
				</nav>
			</div>
		</header>
	);
}

import { component$ } from "@builder.io/qwik";

/** The home page's header: its sections, then the store and the blog. */
export const Header = component$(() => {
	return (
		<header class="app-header">
			<div class="app-header__inner">
				<div class="app-header__brand">Your Business</div>
				<nav>
					<a href="#services">Services</a>
					<a href="#gallery">Gallery</a>
					{/* [bd:booking] */}
					<a href="#booking">Book</a>
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
					<a href="#contact">Contact</a>
				</nav>
			</div>
		</header>
	);
});

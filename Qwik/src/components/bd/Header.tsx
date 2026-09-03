import { component$ } from "@builder.io/qwik";

export const Header = component$(() => {
	return (
		<header class="app-header">
			<div class="app-header__inner">
				<div class="app-header__brand">Your Business</div>
				<nav>
					<a href="#services">Services</a>
					<a href="#gallery">Gallery</a>
					<a href="#booking">Book</a>
					<a href="#blog">Blog</a>
					<a href="#contact">Contact</a>
				</nav>
			</div>
		</header>
	);
});

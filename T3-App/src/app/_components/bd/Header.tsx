import { HeaderAuth } from "@/app/_components/bd/AuthButtons";

export function BdHeader() {
	return (
		<header className="app-header">
			<div className="app-header__inner">
				<div className="app-header__brand">Your Business</div>
				<nav>
					<a href="#services">Services</a>
					<a href="#gallery">Gallery</a>
					<a href="#booking">Book</a>
					<a href="#reviews">Reviews</a>
					<a href="/store">Store</a>
					<a href="#contact">Contact</a>
					<HeaderAuth />
				</nav>
			</div>
		</header>
	);
}

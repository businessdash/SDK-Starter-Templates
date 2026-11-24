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
					{/* [bd:store] */}
					<a href="/store">Store</a>
					{/* [/bd:store] */}
					{/* [bd:saas] */}
					{/* [bd:!store] */}
					<a href="/store/subscriptions">Plans</a>
					{/* [/bd:!store] */}
					{/* [/bd:saas] */}
					<a href="#contact">Contact</a>
					<HeaderAuth />
				</nav>
			</div>
		</header>
	);
}

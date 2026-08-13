import { Link } from "react-router";

/**
 * Shared site header for the non-home routes (store, account, reviews, …).
 * The home route keeps its own anchor-based header for in-page section jumps;
 * this one uses real links + an optional cart-count badge. Plain `<a>` is used
 * for the auth endpoints since those are resource routes, not React routes.
 */
export function SiteHeader({ cartCount = 0 }: { cartCount?: number }) {
	return (
		<header className="header">
			<Link className="brand" to="/">
				Your Business
			</Link>
			<nav>
				<Link to="/store">Store</Link>
				<Link to="/services">Services</Link>
				<Link to="/reviews">Reviews</Link>
				<Link to="/updates">Updates</Link>
				<Link to="/book">Book</Link>
				<Link to="/my-account">Account</Link>
				<Link to="/store/cart" className="cart-link">
					Cart{cartCount > 0 ? <span className="cart-badge">{cartCount}</span> : null}
				</Link>
			</nav>
		</header>
	);
}

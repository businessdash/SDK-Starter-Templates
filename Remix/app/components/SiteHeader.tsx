import { Link } from "react-router";

/**
 * Shared site header for the non-home routes (store, blog, account, reviews,
 * …). The home route keeps its own anchor-based header for in-page section
 * jumps. Store pages add the store bar (wishlist, compare, cart) under it.
 */
export function SiteHeader() {
	return (
		<header className="header">
			<Link className="brand" to="/">
				Your Business
			</Link>
			<nav>
				{/* [bd:store] */}
				<Link to="/store">Store</Link>
				{/* [/bd:store] */}
				{/* [bd:subscriptions] */}
				{/* [bd:!store] */}
				<Link to="/store/subscriptions">Plans</Link>
				{/* [/bd:!store] */}
				{/* [/bd:subscriptions] */}
				{/* [bd:blog] */}
				<Link to="/blog">Blog</Link>
				{/* [/bd:blog] */}
				<Link to="/services">Services</Link>
				<Link to="/reviews">Reviews</Link>
				<Link to="/updates">Updates</Link>
				{/* [bd:booking] */}
				<Link to="/book">Book</Link>
				{/* [/bd:booking] */}
				<Link to="/my-account">Account</Link>
			</nav>
		</header>
	);
}

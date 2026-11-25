import { Link } from "../lib/router";

export function Header() {
	return (
		<header className="app-header">
			<div className="app-header__inner">
				<Link className="app-header__brand" to="/">
					Your Business
				</Link>
				<nav>
					{/* [bd:store] */}
					<Link to="/store">Store</Link>
					{/* [/bd:store] */}
					{/* [bd:subscriptions] */}
					{/* [bd:!store] */}
					<Link to="/subscriptions">Plans</Link>
					{/* [/bd:!store] */}
					{/* [/bd:subscriptions] */}
					{/* [bd:blog] */}
					<Link to="/blog">Blog</Link>
					{/* [/bd:blog] */}
					<Link to="/reviews">Reviews</Link>
					<Link to="/updates">Updates</Link>
					<Link to="/my-account">Account</Link>
				</nav>
			</div>
		</header>
	);
}

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
					{/* [bd:saas] */}
					<Link to="/subscriptions">Plans</Link>
					{/* [/bd:saas] */}
					<Link to="/reviews">Reviews</Link>
					<Link to="/updates">Updates</Link>
					{/* [bd:store] */}
					<Link to="/cart">Cart</Link>
					{/* [/bd:store] */}
					<Link to="/my-account">Account</Link>
				</nav>
			</div>
		</header>
	);
}

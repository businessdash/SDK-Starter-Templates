import { Link } from "../lib/router";

export function Header() {
	return (
		<header className="app-header">
			<div className="app-header__inner">
				<Link className="app-header__brand" to="/">
					Your Business
				</Link>
				<nav>
					<Link to="/store">Store</Link>
					<Link to="/subscriptions">Plans</Link>
					<Link to="/reviews">Reviews</Link>
					<Link to="/updates">Updates</Link>
					<Link to="/cart">Cart</Link>
					<Link to="/my-account">Account</Link>
				</nav>
			</div>
		</header>
	);
}

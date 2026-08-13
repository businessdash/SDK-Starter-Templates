import Link from "next/link";

/**
 * Store layout — wraps every `/store/*` page with a thin sub-nav linking
 * products / subscriptions / cart, plus a link back to the home page. Reuses
 * the home page's sticky `app-header` shell so the storefront feels native.
 */
export default function StoreLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	return (
		<>
			<header className="app-header">
				<div className="app-header__inner">
					<Link className="app-header__brand" href="/">
						Your Business
					</Link>
					<nav>
						<Link href="/store">Products</Link>
						<Link href="/store/subscriptions">Subscriptions</Link>
						<Link href="/store/cart">Cart</Link>
						<Link href="/">Home</Link>
					</nav>
				</div>
			</header>
			<main className="biab-section">{children}</main>
		</>
	);
}

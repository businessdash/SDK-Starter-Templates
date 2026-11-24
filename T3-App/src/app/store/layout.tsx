// [bd-file:store,saas]
import Link from "next/link";

/**
 * Store layout — wraps every page under app/store with a thin sub-nav linking
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
						{/* [bd:store] */}
						<Link href="/store">Products</Link>
						{/* [/bd:store] */}
						{/* [bd:saas] */}
						<Link href="/store/subscriptions">Subscriptions</Link>
						{/* [/bd:saas] */}
						{/* [bd:store] */}
						<Link href="/store/cart">Cart</Link>
						{/* [/bd:store] */}
						<Link href="/">Home</Link>
					</nav>
				</div>
			</header>
			<main className="bd-section">{children}</main>
		</>
	);
}

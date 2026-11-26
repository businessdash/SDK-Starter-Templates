import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

/**
 * Cross-page header for the SDK-surface routes (store, blog, reviews, …).
 * The home page keeps its own anchor-based `<Header />`; this one uses real
 * route links plus the BD auth + account entries. The cart, wishlist and
 * compare links live in the store bar (`<StoreNav />`) on the store pages.
 *
 * Auth uses plain links straight to the catch-all handler — no React
 * `SignIn`/`useUser` needed. `signedIn` is resolved server-side per route via
 * `getCustomerSession` and passed in, so the header reflects session state
 * without leaking the key to the client.
 */
export const SiteHeader = component$<{ signedIn?: boolean }>(
	({ signedIn = false }) => {
		return (
			<header class="app-header">
				<div class="app-header__inner">
					<Link class="app-header__brand" href="/">
						Your Business
					</Link>
					<nav>
						{/* [bd:store] */}
						<Link href="/store">Store</Link>
						{/* [/bd:store] */}
						{/* [bd:subscriptions] */}
						{/* [bd:!store] */}
						<Link href="/subscriptions">Plans</Link>
						{/* [/bd:!store] */}
						{/* [/bd:subscriptions] */}
						{/* [bd:blog] */}
						<Link href="/blog">Blog</Link>
						{/* [/bd:blog] */}
						{/* [bd:booking] */}
						<a href="/#booking">Book</a>
						{/* [/bd:booking] */}
						<Link href="/reviews">Reviews</Link>
						<Link href="/updates">Updates</Link>
						{signedIn ? (
							<>
								<Link href="/my-account">Account</Link>
								<a href="/api/bd-auth/sign-out">Sign out</a>
							</>
						) : (
							<Link href="/my-account">Sign in</Link>
						)}
					</nav>
				</div>
			</header>
		);
	},
);

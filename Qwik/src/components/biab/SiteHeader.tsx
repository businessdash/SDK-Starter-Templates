import { component$ } from "@builder.io/qwik";
import { Link } from "@builder.io/qwik-city";

/**
 * Cross-page header for the SDK-surface routes (store, cart, reviews, …).
 * The home page keeps its own anchor-based `<Header />`; this one uses real
 * route links plus the BIAB auth + account entries.
 *
 * Auth uses plain links straight to the catch-all handler — no React
 * `SignIn`/`useUser` needed. `signedIn` is resolved server-side per route via
 * `getCustomerSession` and passed in, so the header reflects session state
 * without leaking the key to the client.
 */
export const SiteHeader = component$<{ signedIn?: boolean; cartCount?: number }>(
	({ signedIn = false, cartCount = 0 }) => {
		return (
			<header class="app-header">
				<div class="app-header__inner">
					<Link class="app-header__brand" href="/">
						Your Business
					</Link>
					<nav>
						<Link href="/store">Store</Link>
						<Link href="/subscriptions">Plans</Link>
						<Link href="/reviews">Reviews</Link>
						<Link href="/updates">Updates</Link>
						<Link href="/cart">
							Cart{cartCount > 0 ? ` (${cartCount})` : ""}
						</Link>
						{signedIn ? (
							<>
								<Link href="/my-account">Account</Link>
								<a href="/api/biab-auth/sign-out">Sign out</a>
							</>
						) : (
							<a href="/api/biab-auth/sign-in">Sign in</a>
						)}
					</nav>
				</div>
			</header>
		);
	},
);

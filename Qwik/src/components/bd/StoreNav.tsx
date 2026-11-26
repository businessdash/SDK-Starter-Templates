// [bd-file:store,subscriptions]
import { component$ } from "@builder.io/qwik";
// [bd:store]
import { useVisibleTask$ } from "@builder.io/qwik";
// [/bd:store]
import { Link } from "@builder.io/qwik-city";
// [bd:store]
import { elementHtml } from "../../lib/bd-elements";
// [/bd:store]

/**
 * The bar under the header on every store page: products and plans on the
 * left; wishlist, compare and the cart with their counts on the right.
 *
 * The browser loads the shop's custom elements here (src/lib/shop/). They
 * count the wishlist and compare lists saved in this browser, and draw the
 * product page, wishlist and compare table. The cart count comes from the
 * page's loader, then follows each `bd:cart-count` event: the product page
 * sends one when it adds, the cart page after every change.
 */
export const StoreNav = component$<{ cartCount?: number }>(
	({ cartCount = 0 }) => {
		// [bd:store]
		// eslint-disable-next-line qwik/no-use-visible-task
		useVisibleTask$(
			() => {
				void import("../../lib/shop/shop-elements");
			},
			{ strategy: "document-ready" },
		);
		// [/bd:store]
		return (
			<nav aria-label="Store" class="store-nav">
				<div class="store-nav__links">
					{/* [bd:store] */}
					<Link href="/store">Products</Link>
					{/* [/bd:store] */}
					{/* [bd:subscriptions] */}
					<Link href="/subscriptions">Plans</Link>
					{/* [/bd:subscriptions] */}
				</div>
				{/* [bd:store] */}
				<div class="store-nav__links">
					<Link href="/store/wishlist">
						Wishlist
						<span
							dangerouslySetInnerHTML={elementHtml("bd-saved-count", {
								"data-list": "wishlist",
							})}
						/>
					</Link>
					<Link href="/store/compare">
						Compare
						<span
							dangerouslySetInnerHTML={elementHtml("bd-saved-count", {
								"data-list": "compare",
							})}
						/>
					</Link>
					<Link class="store-nav__cart" href="/cart">
						Cart
						<span
							dangerouslySetInnerHTML={elementHtml(
								"bd-cart-count",
								{ "data-count": cartCount },
								undefined,
								cartCount > 0
									? `<span class="store-nav__badge">${cartCount}</span>`
									: "",
							)}
						/>
					</Link>
				</div>
				{/* [/bd:store] */}
			</nav>
		);
	},
);

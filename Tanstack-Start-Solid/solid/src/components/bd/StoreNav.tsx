// [bd-file:store,subscriptions]
import { Link } from "@tanstack/solid-router";

// [bd:store]
import { elementHtml, loadShopElements } from "../../lib/bd-elements";
// [/bd:store]

/**
 * The bar under the header on every store page: products and plans on the
 * left; wishlist, compare and the cart with their counts on the right.
 *
 * It loads the shop's custom elements (src/lib/shop/) in the browser. They
 * count the wishlist and compare lists saved in this browser, draw the
 * wishlist and compare table, and bring the product page's parts to life.
 * The cart count comes from the page's loader, then follows each
 * `bd:cart-count` event: the product page sends one when it adds, the cart
 * page after every change.
 */
export function StoreNav(
	props: { cartCount?: number }, // [bd-line:store]
) {
	// [bd:store]
	loadShopElements();
	// Where the page started; <bd-cart-count> keeps it current.
	const cartCount = props.cartCount ?? 0;
	// [/bd:store]
	return (
		<nav aria-label="Store" class="store-nav">
			<div class="store-nav__links">
				{/* [bd:store] */}
				<Link to="/store">Products</Link>
				{/* [/bd:store] */}
				{/* [bd:subscriptions] */}
				<Link to="/subscriptions">Plans</Link>
				{/* [/bd:subscriptions] */}
			</div>
			{/* [bd:store] */}
			<div class="store-nav__links">
				<Link to="/store/wishlist">
					Wishlist
					<span
						innerHTML={elementHtml("bd-saved-count", {
							"data-list": "wishlist",
						})}
					/>
				</Link>
				<Link to="/store/compare">
					Compare
					<span
						innerHTML={elementHtml("bd-saved-count", {
							"data-list": "compare",
						})}
					/>
				</Link>
				<Link class="store-nav__cart" to="/store/cart">
					Cart
					<span
						innerHTML={elementHtml(
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
}

// [bd-file:store,subscriptions]
/**
 * The bar under the header on every store page: products and plans on the
 * left; wishlist, compare and the cart with their counts on the right.
 *
 * The server reads the cart count for the page. After that the count follows
 * each change: the product page announces what it adds (the `bd:cart-count`
 * event), and every change on /cart sends the new count along with the cart
 * as an htmx out-of-band swap (`cartCountSwap`). The wishlist and compare
 * lists live in this browser, so `/shop/shop-elements.js` fills in their
 * counts there.
 */
// [bd:store]
import { getBd } from "./bd";
// [/bd:store]
import { html, type Raw } from "./html";

/** The browser modules a page with the store bar loads. */
export const STORE_NAV_MODULES: string[] = [
	// [bd:store]
	"/shop/shop-elements.js",
	// [/bd:store]
];

// [bd:store]
/** The items in this visitor's cart; 0 without a cart. */
export async function cartItemCount(visitorToken: string | null): Promise<number> {
	const bd = getBd();
	if (!bd || !visitorToken) return 0;
	try {
		return (await bd.cart.forVisitor(visitorToken).get()).itemCount ?? 0;
	} catch {
		return 0;
	}
}

function cartCount(count: number, outOfBand = false): Raw {
	return html`<bd-cart-count id="store-cart-count" data-count="${String(count)}"${outOfBand ? html` hx-swap-oob="true"` : ""}>${
		count > 0 ? html`<span class="store-nav__badge">${String(count)}</span>` : ""
	}</bd-cart-count>`;
}

/** The bar's cart count again, sent with a cart change: htmx puts it in place. */
export function cartCountSwap(count: number): Raw {
	return cartCount(count, true);
}
// [/bd:store]

/**
 * The store bar. Pass the visitor's cart token, or the count when the page
 * already has the cart.
 */
export async function storeNav(visitorToken: string | null, knownCount?: number): Promise<Raw> {
	// [bd:store]
	const count = knownCount ?? (await cartItemCount(visitorToken));
	// [/bd:store]
	return html`<nav aria-label="Store" class="store-nav">
		<div class="store-nav__links">
			<!-- [bd:store] -->
			<a href="/store">Products</a>
			<!-- [/bd:store] -->
			<!-- [bd:subscriptions] -->
			<a href="/subscriptions">Plans</a>
			<!-- [/bd:subscriptions] -->
		</div>
		<!-- [bd:store] -->
		<div class="store-nav__links">
			<a href="/store/wishlist">Wishlist<bd-saved-count data-list="wishlist"></bd-saved-count></a>
			<a href="/store/compare">Compare<bd-saved-count data-list="compare"></bd-saved-count></a>
			<a class="store-nav__cart" href="/cart">Cart${cartCount(count)}</a>
		</div>
		<!-- [/bd:store] -->
	</nav>`;
}

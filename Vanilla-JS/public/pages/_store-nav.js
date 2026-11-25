// [bd-file:store,subscriptions]
/**
 * The bar under the header on every store page: products and plans on the
 * left; wishlist, compare and the cart with their counts on the right. The
 * counts are custom elements from /shop/shop-elements.js: the saved lists
 * live in this browser, and the cart count follows each change a page
 * announces (the `bd:cart-count` window event).
 */
import { el } from "/bd.js";
// [bd:store]
import { bd } from "/bd.js";
import "/shop/shop-elements.js";
// [/bd:store]

/** Puts the store bar above the page's `<main>`. */
export function mountStoreNav() {
	const main = document.getElementById("app");
	if (!main || document.querySelector(".store-nav")) return;
	// [bd:store]
	const cartCount = el("bd-cart-count", {}, []);
	// [/bd:store]
	const nav = el("nav", { class: "store-nav", "aria-label": "Store" }, [
		el("div", { class: "store-nav__links" }, [
			// [bd:store]
			el("a", { href: "/store" }, ["Products"]),
			// [/bd:store]
			// [bd:subscriptions]
			el("a", { href: "/subscriptions" }, ["Plans"]),
			// [/bd:subscriptions]
		]),
		// [bd:store]
		el("div", { class: "store-nav__links" }, [
			el("a", { href: "/store/wishlist" }, ["Wishlist", el("bd-saved-count", { "data-list": "wishlist" }, [])]),
			el("a", { href: "/store/compare" }, ["Compare", el("bd-saved-count", { "data-list": "compare" }, [])]),
			el("a", { class: "store-nav__cart", href: "/cart" }, ["Cart", cartCount]),
		]),
		// [/bd:store]
	]);
	main.before(nav);
	// [bd:store]
	bd.cart
		.get()
		.then((snapshot) => {
			window.dispatchEvent(new CustomEvent("bd:cart-count", { detail: Number(snapshot?.itemCount) || 0 }));
		})
		.catch(() => {});
	// [/bd:store]
}

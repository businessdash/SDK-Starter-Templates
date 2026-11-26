// [bd-file:store,subscriptions]
import { Link } from "../lib/router";
// [bd:store]
import { useEffect, useState } from "react";

import { bd } from "../lib/bd";
import { CART_EVENT } from "./shop/cart-count";
import { compareList, wishlist } from "./shop/shop";
// [/bd:store]

/**
 * The bar under the header on every store page: products and plans on the
 * left; wishlist, compare and the cart with their counts on the right. The
 * cart count loads here and follows `announceCartCount` (`shop/cart-count.ts`); the saved lists
 * live in this browser.
 */
export function StoreNav() {
	// [bd:store]
	const [cart, setCart] = useState(0);
	const [saved, setSaved] = useState(() => wishlist.read().length);
	const [comparing, setComparing] = useState(() => compareList.read().length);
	useEffect(() => {
		let alive = true;
		bd.cart
			.get()
			.then((snapshot) => {
				if (alive) setCart(Number(snapshot?.itemCount) || 0);
			})
			.catch(() => {});
		const offWish = wishlist.subscribe((items) => setSaved(items.length));
		const offCompare = compareList.subscribe((items) => setComparing(items.length));
		const onCart = (e: Event) => setCart(Number((e as CustomEvent<number>).detail) || 0);
		window.addEventListener(CART_EVENT, onCart);
		return () => {
			alive = false;
			offWish();
			offCompare();
			window.removeEventListener(CART_EVENT, onCart);
		};
	}, []);
	// [/bd:store]

	return (
		<nav aria-label="Store" className="store-nav">
			<div className="store-nav__links">
				{/* [bd:store] */}
				<Link to="/store">Products</Link>
				{/* [/bd:store] */}
				{/* [bd:subscriptions] */}
				<Link to="/subscriptions">Plans</Link>
				{/* [/bd:subscriptions] */}
			</div>
			{/* [bd:store] */}
			<div className="store-nav__links">
				<Link to="/store/wishlist">
					Wishlist
					{saved > 0 && <span className="store-nav__count">{saved}</span>}
				</Link>
				<Link to="/store/compare">
					Compare
					{comparing > 0 && <span className="store-nav__count">{comparing}</span>}
				</Link>
				<Link className="store-nav__cart" to="/cart">
					Cart
					{cart > 0 && <span className="store-nav__badge">{cart}</span>}
				</Link>
			</div>
			{/* [/bd:store] */}
		</nav>
	);
}

// [bd-file:store,subscriptions]
"use client";

import Link from "next/link";
// [bd:store]
import { useEffect, useState } from "react";

import { compareList, wishlist } from "@/app/_components/bd/shop/shop";

const CART_EVENT = "bd:cart-count";

/** Tells the store bar the cart's new item count, after an add. */
export function announceCartCount(count: number) {
	window.dispatchEvent(new CustomEvent(CART_EVENT, { detail: count }));
}
// [/bd:store]

/**
 * The bar under the header on every store page: products and plans on the
 * left; wishlist, compare and the cart with their counts on the right. The
 * saved lists live in this browser, so their counts arrive after load.
 */
export function StoreNav({ cartCount = 0 }: { cartCount?: number }) {
	// [bd:store]
	const [cart, setCart] = useState(cartCount);
	const [saved, setSaved] = useState(0);
	const [comparing, setComparing] = useState(0);
	useEffect(() => setCart(cartCount), [cartCount]);
	useEffect(() => {
		setSaved(wishlist.read().length);
		setComparing(compareList.read().length);
		const offWish = wishlist.subscribe((items) => setSaved(items.length));
		const offCompare = compareList.subscribe((items) =>
			setComparing(items.length),
		);
		const onCart = (e: Event) =>
			setCart(Number((e as CustomEvent<number>).detail) || 0);
		window.addEventListener(CART_EVENT, onCart);
		return () => {
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
				<Link href="/store">Products</Link>
				{/* [/bd:store] */}
				{/* [bd:subscriptions] */}
				<Link href="/store/subscriptions">Subscriptions</Link>
				{/* [/bd:subscriptions] */}
			</div>
			{/* [bd:store] */}
			<div className="store-nav__links">
				<Link href="/store/wishlist">
					Wishlist
					{saved > 0 && <span className="store-nav__count">{saved}</span>}
				</Link>
				<Link href="/store/compare">
					Compare
					{comparing > 0 && (
						<span className="store-nav__count">{comparing}</span>
					)}
				</Link>
				<Link className="store-nav__cart" href="/store/cart">
					Cart
					{cart > 0 && <span className="store-nav__badge">{cart}</span>}
				</Link>
			</div>
			{/* [/bd:store] */}
		</nav>
	);
}

// [bd-file:store]
import type { Metadata } from "next";

import { WishlistView } from "@/app/_components/bd/shop/WishlistView";

export const metadata: Metadata = { title: "Wishlist" };

/** Saved products. The list lives in this browser, so the page is all client. */
export default function WishlistPage() {
	return (
		<>
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Shop</span>
				<h1 className="bd-section__title">Wishlist</h1>
				<p className="bd-section__sub">
					Products you saved on this device. Saved for later, nothing reserved.
				</p>
			</div>
			<WishlistView />
		</>
	);
}

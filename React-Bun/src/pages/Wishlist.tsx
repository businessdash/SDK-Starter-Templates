// [bd-file:store]
import { StoreNav } from "../components/StoreNav";
import { WishlistView } from "../components/shop/WishlistView";

/** Saved products. The list lives in this browser. */
export function Wishlist() {
	return (
		<>
			<StoreNav />
			<main className="bd-page">
				<div className="bd-section__lead">
					<span className="bd-section__eyebrow">Shop</span>
					<h1 className="bd-section__title">Wishlist</h1>
					<p className="bd-section__sub">Products you saved on this device. Saved for later, nothing reserved.</p>
				</div>
				<WishlistView />
			</main>
		</>
	);
}

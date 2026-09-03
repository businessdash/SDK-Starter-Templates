import Link from "next/link";

import { getCartSnapshot } from "@/server/lib/bd-store";

import { CartClient } from "../_components/CartClient";

export const dynamic = "force-dynamic";

export default async function CartPage() {
	const snapshot = await getCartSnapshot();

	return (
		<div>
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Cart</span>
				<h1 className="bd-section__title">Your cart</h1>
			</div>
			{!snapshot || snapshot.items.length === 0 ? (
				<div className="bd-empty">
					Your cart is empty. <Link href="/store">Browse products →</Link>
				</div>
			) : (
				<CartClient initial={snapshot} />
			)}
		</div>
	);
}

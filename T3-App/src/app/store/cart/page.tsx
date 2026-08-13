import Link from "next/link";

import { getCartSnapshot } from "@/server/lib/biab-store";

import { CartClient } from "../_components/CartClient";

export const dynamic = "force-dynamic";

export default async function CartPage() {
	const snapshot = await getCartSnapshot();

	return (
		<div>
			<div className="biab-section__lead">
				<span className="biab-section__eyebrow">Cart</span>
				<h1 className="biab-section__title">Your cart</h1>
			</div>
			{!snapshot || snapshot.items.length === 0 ? (
				<div className="biab-empty">
					Your cart is empty. <Link href="/store">Browse products →</Link>
				</div>
			) : (
				<CartClient initial={snapshot} />
			)}
		</div>
	);
}

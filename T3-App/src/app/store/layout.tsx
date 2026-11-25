// [bd-file:store,subscriptions]
import { BdFooter } from "@/app/_components/bd/Footer";
import { BdHeader } from "@/app/_components/bd/Header";
// [bd:store]
import { getCartSnapshot } from "@/server/lib/bd-store";
// [/bd:store]

import { StoreNav } from "./_components/StoreNav";

/**
 * Every page under /store: the site header, the store bar (products, plans,
 * wishlist, compare, cart) and the footer.
 */
export default async function StoreLayout({
	children,
}: {
	children: React.ReactNode;
}) {
	// Read-only: this never starts a cart, it only counts one that exists.
	const cartCount =
		// [bd:store]
		(await getCartSnapshot())?.itemCount ??
		// [/bd:store]
		0;
	return (
		<>
			<BdHeader />
			<StoreNav cartCount={cartCount} />
			<main className="bd-section">{children}</main>
			<BdFooter />
		</>
	);
}

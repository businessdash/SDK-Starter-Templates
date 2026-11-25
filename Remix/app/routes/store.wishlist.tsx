// [bd-file:store]
import type {
	LinksFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";
import { useLoaderData } from "react-router";

import shopStyles from "~/bd-shop.css?url";
import { SiteHeader } from "~/components/SiteHeader";
import { StoreNav } from "~/components/StoreNav";
import { WishlistView } from "~/components/shop/WishlistView";
import { getCartSnapshot } from "~/lib/bd-store.server";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: shopStyles },
];

export const meta: MetaFunction = () => [{ title: "Wishlist — Store" }];

export async function loader({ request }: LoaderFunctionArgs) {
	return { cartCount: (await getCartSnapshot(request))?.itemCount ?? 0 };
}

/** Saved products. The list lives in this browser, so the page is all client. */
export default function WishlistPage() {
	const { cartCount } = useLoaderData<typeof loader>();
	return (
		<>
			<SiteHeader />
			<StoreNav cartCount={cartCount} />
			<main className="bd-page">
				<div className="bd-section__lead">
					<span className="bd-section__eyebrow">Shop</span>
					<h1 className="bd-section__title">Wishlist</h1>
					<p className="bd-section__sub">
						Products you saved on this device. Saved for later, nothing
						reserved.
					</p>
				</div>
				<WishlistView />
			</main>
		</>
	);
}

// [bd-file:store]
import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";

import { Footer } from "../../../components/bd/Footer";
import { SiteHeader } from "../../../components/bd/SiteHeader";
import { StoreNav } from "../../../components/bd/StoreNav";
import { elementHtml } from "../../../lib/bd-elements";
import { getCustomerSession } from "../../../lib/bd-portal";
import { getCartSnapshot } from "../../../lib/bd-store";

export const useWishlistPage = routeLoader$(async ({ cookie }) => {
	const [cart, session] = await Promise.all([
		getCartSnapshot(cookie),
		getCustomerSession(cookie),
	]);
	return { cartCount: cart?.itemCount ?? 0, signedIn: !!session };
});

/** Products saved on this device with ♡ Save; `<bd-wishlist>` draws them. */
export default component$(() => {
	const data = useWishlistPage();
	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<StoreNav cartCount={data.value.cartCount} />
			<main class="bd-page">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Shop</span>
					<h1 class="bd-section__title">Wishlist</h1>
					<p class="bd-section__sub">Products you saved on this device.</p>
				</div>
				<div
					dangerouslySetInnerHTML={elementHtml(
						"bd-wishlist",
						{},
						undefined,
						'<p class="bd-loading">Loading your wishlist…</p>',
					)}
				/>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Wishlist — Your Business",
	meta: [
		{ name: "description", content: "Products you saved to come back to." },
	],
};

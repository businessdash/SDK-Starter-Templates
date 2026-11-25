// [bd-file:store]
import { createFileRoute } from "@tanstack/solid-router";

import { StoreNav } from "../components/bd/StoreNav";
import { elementHtml } from "../lib/bd-elements";
import { getCartCount } from "../lib/bd-shop-fns";

/** Products saved on this device with ♡ Save; `<bd-wishlist>` draws them. */
export const Route = createFileRoute("/store/wishlist")({
	component: Wishlist,
	loader: async () => ({ cartCount: await getCartCount() }),
	head: () => ({
		meta: [
			{ title: "Wishlist" },
			{ name: "description", content: "Products you saved to come back to." },
		],
	}),
});

function Wishlist() {
	const loaded = Route.useLoaderData();
	return (
		<>
			<StoreNav cartCount={loaded().cartCount} />
			<main class="bd-page">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Shop</span>
					<h1 class="bd-section__title">Wishlist</h1>
					<p class="bd-section__sub">Products you saved on this device.</p>
				</div>
				<div
					innerHTML={elementHtml(
						"bd-wishlist",
						{},
						undefined,
						'<p class="bd-loading">Loading your wishlist…</p>',
					)}
				/>
			</main>
		</>
	);
}

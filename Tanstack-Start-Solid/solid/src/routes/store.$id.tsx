// [bd-file:store]
import { createFileRoute, Link } from "@tanstack/solid-router";
import { Match, Switch } from "solid-js";

import { StoreNav } from "../components/bd/StoreNav";
import { elementHtml, escapeHtml } from "../lib/bd-elements";
import { getCartCount, getProductPage } from "../lib/bd-shop-fns";

/**
 * One product. The loader reads the product, its reviews, add-ons and
 * related products on the server, and `<bd-product>` (src/lib/shop/) draws
 * the page from that data: option photos, option and size buttons, the price
 * for what's chosen, add to cart (POST /api/bd/cart/add), save, compare,
 * share, add-ons, reviews, related and recently viewed. ?reviews=20 shows
 * more reviews.
 */
export const Route = createFileRoute("/store/$id")({
	component: StoreDetail,
	validateSearch: (search: Record<string, unknown>): { reviews?: number } => {
		const n = Number(search.reviews);
		return Number.isInteger(n) && n > 0 ? { reviews: n } : {};
	},
	loaderDeps: ({ search }) => ({ reviews: search.reviews }),
	loader: async ({ params, deps }) => {
		const [page, cartCount] = await Promise.all([
			getProductPage({ data: { id: params.id, reviews: deps.reviews } }),
			getCartCount(),
		]);
		return { page, cartCount };
	},
	head: ({ loaderData }) => {
		const page = loaderData?.page;
		if (!page?.ok) return { meta: [{ title: "Product" }] };
		const { product } = page.data;
		const description =
			typeof product.description === "string" && product.description
				? product.description
				: `${product.name}: choose options and add it to your cart.`;
		return {
			meta: [
				{ title: product.name },
				{ name: "description", content: description },
			],
		};
	},
});

function StoreDetail() {
	const loaded = Route.useLoaderData();
	const page = () => loaded().page;
	const reason = () => {
		const p = page();
		return p.ok ? null : p.reason;
	};

	/** `<bd-product>` with its data, and what shows without JavaScript. */
	const productHtml = () => {
		const p = page();
		if (!p.ok) return "";
		const { product } = p.data;
		const description =
			typeof product.description === "string" ? product.description : "";
		return elementHtml(
			"bd-product",
			{
				"data-add-url": "/api/bd/cart/add",
				"data-cart-href": "/store/cart",
				"data-contact-href": "/#contact",
			},
			p.data,
			// Shown without JavaScript; the element replaces it when it draws.
			`<noscript><h1>${escapeHtml(product.name)}</h1>${
				description ? `<p>${escapeHtml(description)}</p>` : ""
			}<p>Turn on JavaScript to choose options and add this to your cart.</p></noscript>`,
		);
	};

	return (
		<>
			<StoreNav cartCount={loaded().cartCount} />
			<main class="bd-page">
				<Switch fallback={<div innerHTML={productHtml()} />}>
					<Match when={reason() === "suspended"}>
						<div class="bd-empty">
							The store is temporarily unavailable. Please check back soon.
						</div>
					</Match>
					<Match when={reason() === "unconfigured"}>
						<div class="bd-empty">
							Store isn't connected yet. Set the BD env vars (see{" "}
							<code>.env.example</code>) to go live.
						</div>
					</Match>
					<Match when={reason() === "notfound"}>
						<div class="bd-empty">
							That product isn't available.{" "}
							<Link to="/store">Browse the store</Link>
						</div>
					</Match>
				</Switch>
			</main>
		</>
	);
}

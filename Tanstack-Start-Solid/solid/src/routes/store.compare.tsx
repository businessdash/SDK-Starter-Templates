// [bd-file:store]
import { createFileRoute } from "@tanstack/solid-router";

import { StoreNav } from "../components/bd/StoreNav";
import { elementHtml } from "../lib/bd-elements";
import { getCartCount, getComparePage } from "../lib/bd-shop-fns";

/**
 * Up to four products side by side. The products come from ?ids=a,b, so a
 * comparison can be shared; opened without ids, `<bd-compare>` moves this
 * browser's picks into the URL.
 */
export const Route = createFileRoute("/store/compare")({
	component: Compare,
	validateSearch: (search: Record<string, unknown>): { ids?: string } =>
		typeof search.ids === "string" && search.ids ? { ids: search.ids } : {},
	loaderDeps: ({ search }) => ({ ids: search.ids }),
	loader: async ({ deps }) => {
		const ids = (deps.ids ?? "")
			.split(",")
			.map((part) => part.trim())
			.filter(Boolean);
		const [compare, cartCount] = await Promise.all([
			getComparePage({ data: { ids } }),
			getCartCount(),
		]);
		return { compare, cartCount };
	},
	head: () => ({
		meta: [
			{ title: "Compare" },
			{ name: "description", content: "Products side by side." },
		],
	}),
});

function Compare() {
	const loaded = Route.useLoaderData();
	return (
		<>
			<StoreNav cartCount={loaded().cartCount} />
			<main class="bd-page">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Shop</span>
					<h1 class="bd-section__title">Compare</h1>
					<p class="bd-section__sub">Up to four products side by side.</p>
				</div>
				<div innerHTML={elementHtml("bd-compare", {}, loaded().compare)} />
			</main>
		</>
	);
}

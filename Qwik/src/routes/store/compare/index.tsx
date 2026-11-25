// [bd-file:store]
import { component$ } from "@builder.io/qwik";
import { type DocumentHead, routeLoader$ } from "@builder.io/qwik-city";

import { Footer } from "../../../components/bd/Footer";
import { SiteHeader } from "../../../components/bd/SiteHeader";
import { StoreNav } from "../../../components/bd/StoreNav";
import { getBd } from "../../../lib/bd";
import { elementHtml } from "../../../lib/bd-elements";
import { getCustomerSession } from "../../../lib/bd-portal";
import { getCartSnapshot, getStoreProductReviews } from "../../../lib/bd-store";
import type { CompareColumn } from "../../../lib/shop/shop-elements";

/**
 * Up to four products side by side. The products come from ?ids=a,b, so a
 * comparison can be shared; opened without ids, `<bd-compare>` moves this
 * browser's picks into the URL.
 */
export const useComparePage = routeLoader$(async ({ cookie, query }) => {
	const ids = (query.get("ids") ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.slice(0, 4);
	const bd = getBd();
	const [cart, session, columns] = await Promise.all([
		getCartSnapshot(cookie),
		getCustomerSession(cookie),
		Promise.all(
			ids.map(async (id): Promise<CompareColumn | null> => {
				if (!bd) return null;
				try {
					const [product, reviews] = await Promise.all([
						bd.storefront.getProduct(id),
						getStoreProductReviews(id, { limit: 1 }),
					]);
					return {
						product,
						rating:
							reviews && reviews.totalCount > 0
								? { avg: reviews.avgRating, count: reviews.totalCount }
								: null,
					};
				} catch {
					return null;
				}
			}),
		),
	]);
	return {
		ids,
		columns: columns.filter((column): column is CompareColumn => column !== null),
		cartCount: cart?.itemCount ?? 0,
		signedIn: !!session,
	};
});

export default component$(() => {
	const data = useComparePage();
	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} />
			<StoreNav cartCount={data.value.cartCount} />
			<main class="bd-page">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Shop</span>
					<h1 class="bd-section__title">Compare</h1>
					<p class="bd-section__sub">Up to four products side by side.</p>
				</div>
				<div
					dangerouslySetInnerHTML={elementHtml(
						"bd-compare",
						{},
						{ ids: data.value.ids, columns: data.value.columns },
					)}
				/>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = {
	title: "Compare — Your Business",
	meta: [{ name: "description", content: "Products side by side." }],
};

// [bd-file:store]
/**
 * /store/compare — up to four products side by side: price, rating,
 * category, options and every spec any of them lists. The products come
 * from ?ids=a,b, so a comparison can be shared; opened without ids,
 * `<bd-compare>` from /shop/shop-elements.js moves this browser's picks into
 * the URL.
 */
import "/shop/shop-elements.js";
import { bd, el } from "/bd.js";
import { mountStoreNav } from "./_store-nav.js";

export default async function render(root) {
	mountStoreNav();
	const ids = (new URLSearchParams(location.search).get("ids") ?? "")
		.split(",")
		.map((part) => part.trim())
		.filter(Boolean)
		.slice(0, 4);
	const lead = el("div", { class: "bd-section__lead" }, [
		el("span", { class: "bd-section__eyebrow" }, ["Shop"]),
		el("h1", { class: "bd-section__title" }, ["Compare"]),
		el("p", { class: "bd-section__sub" }, ["Up to four products side by side."]),
	]);
	root.replaceChildren(lead, el("p", { class: "bd-loading" }, ["Loading…"]));

	const columns = (
		await Promise.all(
			ids.map(async (id) => {
				try {
					const [product, reviews] = await Promise.all([
						bd.storefront.getProduct(id),
						bd.storefront.getProductReviews(id, { limit: 1 }).catch(() => null),
					]);
					return {
						product,
						rating: reviews && reviews.totalCount > 0 ? { avg: reviews.avgRating, count: reviews.totalCount } : null,
					};
				} catch {
					return null;
				}
			}),
		)
	).filter(Boolean);

	const table = el("bd-compare", { "data-store-href": "/store" }, [
		el("script", { type: "application/json" }, [JSON.stringify({ ids, columns })]),
	]);
	root.replaceChildren(lead, table);
}

// [bd-file:store]
/**
 * /store — the product list. Every filter is in the URL (?q, ?category,
 * ?min, ?max, ?rating, ?sort): the facets are links and the search, price
 * and sort are plain GET forms, so a filtered list can be shared and the
 * back button steps through filters. The page is laid out from the shop's
 * parts (/sections/shop/): the filters, and a product card per product with
 * save and compare (`<bd-save-buttons>` from /shop/shop-elements.js).
 */
import "/shop/shop-elements.js";
import { bd, el } from "/bd.js";
import { categoryFilter } from "/sections/shop/category-filter.js";
import { clearFilters } from "/sections/shop/clear-filters.js";
import { compareBar } from "/sections/shop/compare-bar.js";
import { priceFilter } from "/sections/shop/price-filter.js";
import { productGrid } from "/sections/shop/product-grid.js";
import { ratingFilter } from "/sections/shop/rating-filter.js";
import { sortSelect } from "/sections/shop/sort-select.js";
import { hasFilters, sortOf } from "/sections/shop/store-filters.js";
import { storeSearch } from "/sections/shop/store-search.js";
import { errBox } from "./_ui.js";
import { mountStoreNav } from "./_store-nav.js";

function parseCents(raw) {
	if (!raw) return undefined;
	const dollars = Number.parseFloat(raw);
	return Number.isFinite(dollars) ? Math.round(dollars * 100) : undefined;
}

export default async function render(root) {
	mountStoreNav();
	const params = new URLSearchParams(location.search);
	const ratingRaw = Number.parseInt(params.get("rating") ?? "", 10);
	const filtered = hasFilters(params);

	const lead = el("div", { class: "bd-section__lead" }, [
		el("span", { class: "bd-section__eyebrow" }, ["Shop"]),
		el("h1", { class: "bd-section__title" }, ["Products"]),
		el("p", { class: "bd-section__sub" }, [
			"Filter, sort, and open a product to choose its options and add it to your cart.",
		]),
	]);
	root.replaceChildren(lead, el("p", { class: "bd-loading" }, ["Loading products…"]));

	let data;
	let categoryList = [];
	try {
		const [meta, cats] = await Promise.all([
			bd.storefront.listProductsWithMeta({
				limit: 48,
				search: params.get("q")?.trim() || undefined,
				categoryId: params.get("category") || undefined,
				minPriceCents: parseCents(params.get("min")),
				maxPriceCents: parseCents(params.get("max")),
				minRating: ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : undefined,
				sort: sortOf(params),
			}),
			bd.storefront.listCategories().catch(() => ({ items: [] })),
		]);
		data = meta;
		categoryList = cats?.items ?? [];
	} catch (err) {
		root.replaceChildren(lead, errBox(err));
		return;
	}

	const products = data?.items ?? [];
	const counts = new Map((data?.categoryCounts ?? []).map((c) => [c.categoryId, c.count]));
	const categories = categoryList.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 }));

	const sidebar = el("aside", { class: "store-sidebar" }, [
		storeSearch(params),
		categoryFilter(params, categories),
		priceFilter(params, data?.priceRange),
		ratingFilter(params),
		filtered ? clearFilters() : null,
	]);

	const results = el("div", { class: "store-results" }, [
		el("div", { class: "store-results__bar" }, [
			el("p", { class: "bd-loading" }, [`${products.length} ${products.length === 1 ? "product" : "products"}`]),
			sortSelect(params),
		]),
		products.length === 0
			? el("div", { class: "bd-empty" }, [
					filtered
						? "No products match these filters. Try clearing a filter or broadening your search."
						: "No live products yet. Add and publish products in the BD dashboard and they'll appear here.",
				])
			: productGrid(products),
		compareBar(),
	]);

	root.replaceChildren(lead, el("div", { class: "store-layout" }, [sidebar, results]));
}

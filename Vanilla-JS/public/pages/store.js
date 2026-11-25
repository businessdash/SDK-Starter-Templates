// [bd-file:store]
/**
 * /store — the product list. Every filter is in the URL (?q, ?category,
 * ?min, ?max, ?rating, ?sort): the facets are links and the search, price
 * and sort are plain GET forms, so a filtered list can be shared and the
 * back button steps through filters. Save and compare on each card are
 * `<bd-save-buttons>` from /shop/shop-elements.js.
 */
import { starRating } from "/shop/shop-elements.js";
import { bd, el, money } from "/bd.js";
import { errBox } from "./_ui.js";
import { mountStoreNav } from "./_store-nav.js";

const SORTS = [
	{ value: "featured", label: "Featured" },
	{ value: "newest", label: "Newest" },
	{ value: "price-asc", label: "Price: low to high" },
	{ value: "price-desc", label: "Price: high to low" },
	{ value: "rating-desc", label: "Top rated" },
];

function parseCents(raw) {
	if (!raw) return undefined;
	const dollars = Number.parseFloat(raw);
	return Number.isFinite(dollars) ? Math.round(dollars * 100) : undefined;
}

export default async function render(root) {
	mountStoreNav();
	const params = new URLSearchParams(location.search);
	const search = params.get("q")?.trim() || undefined;
	const categoryId = params.get("category") || undefined;
	const sortRaw = params.get("sort");
	const sort = SORTS.some((s) => s.value === sortRaw) ? sortRaw : "featured";
	const minPriceCents = parseCents(params.get("min"));
	const maxPriceCents = parseCents(params.get("max"));
	const ratingRaw = Number.parseInt(params.get("rating") ?? "", 10);
	const minRating = ratingRaw >= 1 && ratingRaw <= 5 ? ratingRaw : undefined;
	const hasFilters = ["q", "category", "min", "max", "rating"].some((key) => params.get(key));

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
				search,
				categoryId,
				minPriceCents,
				maxPriceCents,
				minRating,
				sort,
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
	const priceRange = data?.priceRange;

	/** This list with some filters changed (null removes one). */
	function hrefWith(changes) {
		const next = new URLSearchParams(params);
		for (const [key, value] of Object.entries(changes)) {
			if (value === null || value === "") next.delete(key);
			else next.set(key, value);
		}
		const qs = next.toString();
		return qs ? `/store?${qs}` : "/store";
	}

	/** The filters a form leaves alone, carried along as hidden fields. */
	function keep(...replaced) {
		return [...params]
			.filter(([key]) => !replaced.includes(key))
			.map(([name, value]) => el("input", { type: "hidden", name, value }));
	}

	const sortSelect = el(
		"select",
		{ class: "bd-select", id: "store-sort", name: "sort" },
		SORTS.map((s) => el("option", { value: s.value, selected: s.value === sort }, [s.label])),
	);
	// The sort applies as soon as it changes.
	sortSelect.addEventListener("change", () => sortSelect.form?.requestSubmit());

	const sidebar = el("aside", { class: "store-sidebar" }, [
		el("form", { action: "/store", method: "get" }, [
			el("label", { class: "bd-label", for: "store-search" }, ["Search"]),
			el("input", {
				autocomplete: "off",
				class: "bd-input",
				id: "store-search",
				name: "q",
				placeholder: "Search products…",
				type: "search",
				value: params.get("q") ?? "",
			}),
			...keep("q"),
		]),

		categories.length > 0
			? el("div", { class: "store-facet" }, [
					el("p", { class: "store-facet__title" }, ["Category"]),
					el("ul", { class: "store-facet__list" }, [
						el("li", {}, [
							el(
								"a",
								{
									class: `store-facet__item${categoryId ? "" : " store-facet__item--active"}`,
									href: hrefWith({ category: null }),
								},
								["All products"],
							),
						]),
						...categories.map((c) => {
							const active = categoryId === c.id;
							return el("li", {}, [
								el(
									"a",
									{
										class: `store-facet__item store-facet__item--row${active ? " store-facet__item--active" : ""}`,
										href: hrefWith({ category: active ? null : c.id }),
									},
									[el("span", {}, [c.name]), el("span", { class: "store-facet__count" }, [String(c.count)])],
								),
							]);
						}),
					]),
				])
			: null,

		el("form", { action: "/store", class: "store-facet", method: "get" }, [
			el("p", { class: "store-facet__title" }, ["Price"]),
			el("div", { class: "store-price" }, [
				el("input", {
					"aria-label": "Lowest price",
					class: "bd-input",
					inputmode: "decimal",
					name: "min",
					placeholder: priceRange ? `$${Number(priceRange.minDollars).toFixed(0)}` : "Min",
					value: params.get("min") ?? "",
				}),
				el("span", { "aria-hidden": "true", class: "store-price__sep" }, ["–"]),
				el("input", {
					"aria-label": "Highest price",
					class: "bd-input",
					inputmode: "decimal",
					name: "max",
					placeholder: priceRange ? `$${Number(priceRange.maxDollars).toFixed(0)}` : "Max",
					value: params.get("max") ?? "",
				}),
			]),
			...keep("min", "max"),
			el("button", { class: "bd-btn bd-btn--ghost store-price__apply", type: "submit" }, ["Apply"]),
		]),

		el("div", { class: "store-facet" }, [
			el("p", { class: "store-facet__title" }, ["Rating"]),
			el(
				"ul",
				{ class: "store-facet__list" },
				[4, 3, 2].map((r) => {
					const active = minRating === r;
					return el("li", {}, [
						el(
							"a",
							{
								class: `store-facet__item store-facet__rating${active ? " store-facet__item--active" : ""}`,
								href: hrefWith({ rating: active ? null : String(r) }),
							},
							[starRating(r), el("span", { class: "store-facet__count" }, ["& up"])],
						),
					]);
				}),
			),
		]),

		hasFilters ? el("a", { class: "store-clear", href: "/store" }, ["Clear all filters"]) : null,
	]);

	const results = el("div", { class: "store-results" }, [
		el("div", { class: "store-results__bar" }, [
			el("p", { class: "bd-loading" }, [`${products.length} ${products.length === 1 ? "product" : "products"}`]),
			el("form", { action: "/store", class: "store-sort", method: "get" }, [
				el("label", { for: "store-sort" }, ["Sort"]),
				sortSelect,
				...keep("sort"),
			]),
		]),
		products.length === 0
			? el("div", { class: "bd-empty" }, [
					hasFilters
						? "No products match these filters. Try clearing a filter or broadening your search."
						: "No live products yet. Add and publish products in the BD dashboard and they'll appear here.",
				])
			: el("div", { class: "bd-grid-3" }, products.map(productCard)),
		el("bd-compare-bar", {}, []),
	]);

	root.replaceChildren(lead, el("div", { class: "store-layout" }, [sidebar, results]));
}

function productCard(p) {
	return el("div", { class: "bd-card product-card" }, [
		el("a", { class: "product-card__link", href: `/store/${encodeURIComponent(p.id)}` }, [
			el("div", { class: "product-card__media" }, [
				p.coverImage
					? el("img", {
							alt: p.name,
							class: "product-card__img",
							loading: "lazy",
							referrerpolicy: "no-referrer",
							src: p.coverImage,
						})
					: el("div", { class: "product-card__noimg" }, ["No image"]),
				el("div", { class: "product-card__badges" }, [
					p.isBestSeller ? el("span", { class: "bd-badge" }, ["Best seller"]) : null,
					p.isNew ? el("span", { class: "bd-badge" }, ["New"]) : null,
					p.isOnSale ? el("span", { class: "bd-badge product-card__badge--sale" }, ["Sale"]) : null,
				]),
			]),
			el("div", { class: "product-card__body" }, [
				el("h3", {}, [p.name || "Untitled"]),
				p.reviewCount > 0
					? el("div", { class: "product-card__rating" }, [
							starRating(p.avgRating),
							el("span", { class: "product-card__count" }, [`(${p.reviewCount})`]),
						])
					: null,
				el("div", { class: "product-card__price" }, [
					el("span", { class: "product-card__amount" }, [
						p.cheapestPriceCents != null
							? `${p.hasMultipleVariants ? "From " : ""}${money(p.cheapestPriceCents)}`
							: "View details",
					]),
					p.isOnSale && p.comparePriceCents != null
						? el("span", { class: "product-card__compare" }, [money(p.comparePriceCents)])
						: null,
				]),
				p.isLowStock ? el("span", { class: "product-card__lowstock" }, ["Low stock"]) : null,
			]),
		]),
		el("div", { class: "product-card__save" }, [
			el("bd-save-buttons", {
				compact: true,
				"data-product": JSON.stringify({
					id: p.id,
					name: p.name,
					image: p.coverImage,
					priceCents: p.cheapestPriceCents,
				}),
			}),
		]),
	]);
}

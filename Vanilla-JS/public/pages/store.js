/**
 * /store — full shop page on `biab.storefront.listProductsWithMeta`.
 *
 * The meta endpoint returns enriched grid cards (price / compare-at / rating /
 * badges) plus the facets a sidebar needs: `categoryCounts` (merged with
 * `listCategories()` for names), the catalog-wide `priceRange`, and the sort +
 * min-rating controls. State lives in the URL query so a filtered grid is
 * shareable + back-button friendly; we re-fetch on every change.
 */
import { biab, el, money } from "/biab.js";
import { errBox, pageHead } from "./_ui.js";

const SORTS = [
	["featured", "Featured"],
	["newest", "Newest"],
	["price-asc", "Price: low to high"],
	["price-desc", "Price: high to low"],
	["rating-desc", "Top rated"],
];

export default async function render(root) {
	root.replaceChildren(pageHead("Store", "Native storefront on the BIAB SDK."));

	// Category names (best-effort — facets still work without them).
	let categories = [];
	try {
		const res = await biab.storefront.listCategories();
		categories = res?.items ?? [];
	} catch {
		// no names → fall back to the raw categoryId label
	}
	const categoryName = (id) => categories.find((c) => c.id === id)?.name ?? id;

	const layout = el("div", { class: "store-layout" });
	const sidebar = el("aside", { class: "store-sidebar" });
	const main = el("div", { class: "store-main" });
	layout.append(sidebar, main);
	root.append(layout);

	// Filter state, seeded from the URL.
	const params = new URLSearchParams(location.search);
	const state = {
		search: params.get("search") ?? "",
		categoryId: params.get("categoryId") ?? "",
		minRating: params.has("minRating") ? Number(params.get("minRating")) : 0,
		maxPriceCents: params.has("maxPriceCents") ? Number(params.get("maxPriceCents")) : null,
		sort: params.get("sort") ?? "featured",
	};

	function syncUrl() {
		const q = new URLSearchParams();
		if (state.search) q.set("search", state.search);
		if (state.categoryId) q.set("categoryId", state.categoryId);
		if (state.minRating) q.set("minRating", String(state.minRating));
		if (state.maxPriceCents != null) q.set("maxPriceCents", String(state.maxPriceCents));
		if (state.sort && state.sort !== "featured") q.set("sort", state.sort);
		const next = q.toString();
		history.replaceState(null, "", next ? `${location.pathname}?${next}` : location.pathname);
	}

	async function load() {
		main.replaceChildren(el("p", { class: "page__loading" }, ["Loading…"]));
		syncUrl();
		try {
			const res = await biab.storefront.listProductsWithMeta({
				limit: 48,
				...(state.search ? { search: state.search } : {}),
				...(state.categoryId ? { categoryId: state.categoryId } : {}),
				...(state.minRating ? { minRating: state.minRating } : {}),
				...(state.maxPriceCents != null ? { maxPriceCents: state.maxPriceCents } : {}),
				...(state.sort ? { sort: state.sort } : {}),
			});
			sidebar.replaceChildren(renderSidebar(res));
			const items = res?.items ?? [];
			if (!items.length) {
				main.replaceChildren(el("p", { class: "muted" }, ["No products match these filters."]));
				return;
			}
			main.replaceChildren(
				renderToolbar(items.length),
				el("div", { class: "product-grid" }, items.map(productCard)),
			);
		} catch (err) {
			main.replaceChildren(errBox(err));
		}
	}

	function renderToolbar(count) {
		const sort = el(
			"select",
			{
				class: "biab-select store-sort",
				"aria-label": "Sort products",
				onChange: (e) => {
					state.sort = e.target.value;
					load();
				},
			},
			SORTS.map(([value, label]) =>
				el("option", { value, ...(value === state.sort ? { selected: true } : {}) }, [label]),
			),
		);
		return el("div", { class: "store-toolbar" }, [
			el("span", { class: "muted" }, [`${count} product${count === 1 ? "" : "s"}`]),
			sort,
		]);
	}

	function renderSidebar(res) {
		const counts = res?.categoryCounts ?? [];
		const range = res?.priceRange ?? null;

		// Search box.
		const searchInput = el("input", {
			class: "biab-input",
			type: "search",
			placeholder: "Search products",
			value: state.search,
			autocomplete: "off",
		});
		const searchForm = el(
			"form",
			{
				class: "store-facet",
				onSubmit: (e) => {
					e.preventDefault();
					state.search = searchInput.value.trim();
					load();
				},
			},
			[searchInput],
		);

		// Categories with counts.
		const catList = el("ul", { class: "store-facet__list" }, [
			facetRow("All products", !state.categoryId, () => {
				state.categoryId = "";
				load();
			}),
			...counts.map((c) =>
				facetRow(`${categoryName(c.categoryId)} (${c.count})`, state.categoryId === c.categoryId, () => {
					state.categoryId = state.categoryId === c.categoryId ? "" : c.categoryId;
					load();
				}),
			),
		]);

		// Min rating.
		const ratingList = el("ul", { class: "store-facet__list" }, [
			facetRow("Any rating", !state.minRating, () => {
				state.minRating = 0;
				load();
			}),
			...[4, 3, 2, 1].map((r) =>
				facetRow(`${stars(r)} & up`, state.minRating === r, () => {
					state.minRating = state.minRating === r ? 0 : r;
					load();
				}),
			),
		]);

		// Max price slider (priceRange is in dollars).
		let priceBlock = null;
		if (range && range.maxDollars > range.minDollars) {
			const maxCents = Math.ceil(range.maxDollars * 100);
			const minCents = Math.floor(range.minDollars * 100);
			const slider = el("input", {
				class: "store-price__slider",
				type: "range",
				min: String(minCents),
				max: String(maxCents),
				value: String(state.maxPriceCents ?? maxCents),
				step: "100",
			});
			const label = el("span", { class: "store-price__value" }, [
				`Up to ${money(state.maxPriceCents ?? maxCents)}`,
			]);
			slider.addEventListener("input", () => {
				label.textContent = `Up to ${money(Number(slider.value))}`;
			});
			slider.addEventListener("change", () => {
				const v = Number(slider.value);
				state.maxPriceCents = v >= maxCents ? null : v;
				load();
			});
			priceBlock = el("div", { class: "store-facet store-price" }, [label, slider]);
		}

		return el("div", { class: "store-sidebar__inner" }, [
			facetGroup("Search", searchForm),
			counts.length ? facetGroup("Category", catList) : null,
			facetGroup("Rating", ratingList),
			priceBlock ? facetGroup("Price", priceBlock) : null,
		]);
	}

	load();
}

function facetGroup(title, body) {
	return el("div", { class: "store-facet-group" }, [
		el("h3", { class: "store-facet-group__title" }, [title]),
		body,
	]);
}

function facetRow(label, active, onClick) {
	return el("li", {}, [
		el(
			"button",
			{
				type: "button",
				class: `store-facet__btn${active ? " store-facet__btn--active" : ""}`,
				"aria-pressed": active ? "true" : "false",
				onClick,
			},
			[label],
		),
	]);
}

function productCard(p) {
	const badges = [];
	if (p.isBestSeller) badges.push(badge("Best seller", "biab-badge"));
	if (p.isNew) badges.push(badge("New", "biab-badge"));
	if (p.isOnSale) badges.push(badge("Sale", "biab-badge store-badge--sale"));
	if (p.isLowStock) badges.push(badge("Low stock", "biab-badge store-badge--low"));

	const priceRow = [];
	if (p.cheapestPriceCents != null) {
		priceRow.push(
			el("span", { class: "product-card__price" }, [
				p.hasMultipleVariants ? `From ${money(p.cheapestPriceCents)}` : money(p.cheapestPriceCents),
			]),
		);
	}
	if (p.isOnSale && p.comparePriceCents != null) {
		priceRow.push(el("span", { class: "product-card__compare" }, [money(p.comparePriceCents)]));
	}

	return el("a", { class: "product-card", href: `/store/${encodeURIComponent(p.id)}` }, [
		el("div", { class: "product-card__media" }, [
			p.coverImage
				? el("img", { class: "product-card__img", src: p.coverImage, alt: p.name, loading: "lazy" })
				: el("div", { class: "product-card__img product-card__img--ph" }),
			badges.length ? el("div", { class: "product-card__badges" }, badges) : null,
		]),
		el("div", { class: "product-card__body" }, [
			el("div", { class: "product-card__name" }, [p.name ?? "Product"]),
			p.reviewCount
				? el("div", { class: "product-card__rating" }, [
						el("span", { class: "product-card__stars" }, [stars(Math.round(p.avgRating))]),
						el("span", { class: "product-card__reviews muted" }, [
							` ${p.avgRating.toFixed(1)} (${p.reviewCount})`,
						]),
					])
				: null,
			priceRow.length ? el("div", { class: "product-card__pricing" }, priceRow) : null,
		]),
	]);
}

function badge(text, cls) {
	return el("span", { class: cls }, [text]);
}

function stars(n) {
	const full = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
	return "★".repeat(full) + "☆".repeat(5 - full);
}

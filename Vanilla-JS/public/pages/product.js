/**
 * /store/:id — product detail + add-to-cart, enriched with the 0.9.12 surfaces:
 * customer reviews (`getProductReviews`), "you may also like" related products
 * (`getRelatedProducts`), and companion cross-sell addons (`getProductAddons`).
 * Each enrichment loads independently and degrades to nothing if unavailable, so
 * the detail page always renders the core product even when an extra 404s.
 */
import { bd, dollars, el, money } from "/bd.js";
import { errBox } from "./_ui.js";

export default async function render(root) {
	const id = decodeURIComponent(location.pathname.split("/")[2] ?? "");
	root.replaceChildren(el("p", { class: "page__loading" }, ["Loading…"]));
	if (!id) {
		root.replaceChildren(errBox("Missing product id."));
		return;
	}
	let product;
	try {
		product = await bd.storefront.getProduct(id);
	} catch (err) {
		root.replaceChildren(errBox(err));
		return;
	}

	const variants = Array.isArray(product.variants) ? product.variants : [];
	const images = Array.isArray(product.images) ? product.images : [];
	const select = variants.length
		? el(
				"select",
				{ class: "product-detail__variant" },
				variants.map((v) =>
					el("option", { value: v.id ?? v.variantId ?? "" }, [
						`${v.title ?? v.name ?? "Variant"}${v.price != null ? ` — ${dollars(v.price, v.currency ?? product.currency)}` : ""}`,
					]),
				),
			)
		: null;

	const status = el("p", { class: "product-detail__status" }, []);
	const addBtn = el(
		"button",
		{
			class: "btn btn--primary",
			type: "button",
			onClick: async () => {
				addBtn.disabled = true;
				status.textContent = "Adding…";
				try {
					const variantId = select ? select.value || null : null;
					const snap = await bd.cart.add({ productId: id, variantId, quantity: 1 });
					status.textContent = `Added — cart has ${snap.itemCount ?? "?"} item(s). `;
					status.append(el("a", { href: "/cart" }, ["View cart →"]));
				} catch (err) {
					status.textContent = `Couldn't add: ${err?.message ?? err}`;
				} finally {
					addBtn.disabled = false;
				}
			},
		},
		["Add to cart"],
	);

	// Enrichment containers — filled in asynchronously below.
	const reviewsBlock = el("section", { class: "product-reviews" });
	const addonsBlock = el("section", { class: "product-addons" });
	const relatedBlock = el("section", { class: "product-related" });

	root.replaceChildren(
		el("a", { class: "backlink", href: "/store" }, ["← Back to store"]),
		el("div", { class: "product-detail" }, [
			images[0]
				? el("img", { class: "product-detail__img", src: images[0], alt: product.name })
				: el("div", { class: "product-detail__img product-detail__img--ph" }),
			el("div", { class: "product-detail__body" }, [
				el("h1", { class: "product-detail__name" }, [product.name ?? "Product"]),
				product.description ? el("p", { class: "product-detail__desc" }, [product.description]) : null,
				select,
				addBtn,
				status,
			]),
		]),
		addonsBlock,
		reviewsBlock,
		relatedBlock,
	);

	// Load enrichments independently (graceful — failures leave a block empty).
	loadReviews(id, reviewsBlock);
	loadAddons(id, addonsBlock);
	loadRelated(id, relatedBlock);
}

// ── reviews ─────────────────────────────────────────────────────────

async function loadReviews(id, block) {
	let res;
	try {
		res = await bd.storefront.getProductReviews(id, { limit: 10 });
	} catch {
		return; // endpoint unavailable → no reviews section
	}
	const items = res?.items ?? [];
	if (!items.length) return;
	block.replaceChildren(
		el("h2", { class: "section-title" }, ["Customer reviews"]),
		el("div", { class: "product-reviews__summary" }, [
			el("span", { class: "product-reviews__avg" }, [stars(Math.round(res.avgRating))]),
			el("span", { class: "muted" }, [
				` ${Number(res.avgRating ?? 0).toFixed(1)} · ${res.totalCount} review${res.totalCount === 1 ? "" : "s"}`,
			]),
		]),
		el(
			"ul",
			{ class: "product-reviews__list" },
			items.map((r) =>
				el("li", { class: "product-review" }, [
					el("div", { class: "product-review__head" }, [
						el("span", { class: "product-review__stars" }, [stars(r.rating)]),
						el("span", { class: "product-review__who" }, [r.reviewerName ?? "Anonymous"]),
					]),
					r.title ? el("div", { class: "product-review__title" }, [r.title]) : null,
					el("p", { class: "product-review__text" }, [r.body ?? r.content ?? ""]),
				]),
			),
		),
	);
}

// ── companion addons (cross-sell) ───────────────────────────────────

async function loadAddons(id, block) {
	let res;
	try {
		res = await bd.storefront.getProductAddons(id);
	} catch {
		return;
	}
	const items = res?.items ?? [];
	if (!items.length) return;
	block.replaceChildren(
		el("h2", { class: "section-title" }, ["Complete your purchase"]),
		el(
			"div",
			{ class: "addon-grid" },
			items.map((a) => {
				const onSale = a.originalPriceCents != null && a.originalPriceCents > (a.priceCents ?? 0);
				return el("div", { class: "addon-card" }, [
					a.imageUrl
						? el("img", { class: "addon-card__img", src: a.imageUrl, alt: a.addonName, loading: "lazy" })
						: el("div", { class: "addon-card__img addon-card__img--ph" }),
					el("div", { class: "addon-card__body" }, [
						a.groupLabel ? el("span", { class: "addon-card__group" }, [a.groupLabel]) : null,
						el("div", { class: "addon-card__name" }, [a.addonName]),
						a.addonDescription ? el("p", { class: "addon-card__desc muted" }, [a.addonDescription]) : null,
						el("div", { class: "addon-card__pricing" }, [
							a.priceCents != null ? el("span", { class: "addon-card__price" }, [money(a.priceCents)]) : null,
							onSale ? el("span", { class: "addon-card__compare" }, [money(a.originalPriceCents)]) : null,
						]),
						el(
							"a",
							{ class: "btn btn--ghost btn--sm", href: `/store/${encodeURIComponent(a.addonProductId)}` },
							["View"],
						),
					]),
				]);
			}),
		),
	);
}

// ── related ("you may also like") ───────────────────────────────────

async function loadRelated(id, block) {
	let res;
	try {
		res = await bd.storefront.getRelatedProducts(id, { limit: 6 });
	} catch {
		return;
	}
	const items = res?.items ?? [];
	if (!items.length) return;
	block.replaceChildren(
		el("h2", { class: "section-title" }, ["You may also like"]),
		el(
			"div",
			{ class: "product-grid" },
			items.map((p) =>
				el("a", { class: "product-card", href: `/store/${encodeURIComponent(p.id)}` }, [
					el("div", { class: "product-card__media" }, [
						p.coverImageUrl
							? el("img", { class: "product-card__img", src: p.coverImageUrl, alt: p.name, loading: "lazy" })
							: el("div", { class: "product-card__img product-card__img--ph" }),
					]),
					el("div", { class: "product-card__body" }, [
						el("div", { class: "product-card__name" }, [p.name ?? "Product"]),
						p.minPriceDollars != null
							? el("div", { class: "product-card__price" }, [`From ${dollars(p.minPriceDollars)}`])
							: null,
					]),
				]),
			),
		),
	);
}

function stars(n) {
	const full = Math.max(0, Math.min(5, Math.round(Number(n) || 0)));
	return "★".repeat(full) + "☆".repeat(5 - full);
}

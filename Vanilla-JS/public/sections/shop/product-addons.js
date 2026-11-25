// [bd-file:store]
import { el } from "/bd.js";
import { formatCents } from "/shop/shop.js";

/** The variant an add-on is added as: its first. */
function addonVariant(addon) {
	const first = Array.isArray(addon.variants) ? addon.variants[0] : undefined;
	const id = first?.variantId ?? first?.id;
	return typeof id === "string" ? id : null;
}

/** "Complete your purchase": add-ons, each added to the cart by `<bd-addon>`. */
export function productAddons(addons, { addUrl = "/api/bd/cart/add" } = {}) {
	if (addons.length === 0) return null;
	return el("section", { class: "product-section" }, [
		el("h2", { class: "product-section__title" }, ["Complete your purchase"]),
		el(
			"div",
			{ class: "addon-grid" },
			addons.map((addon) =>
				el("div", { class: "addon-card bd-card" }, [
					el("div", { class: "addon-card__media" }, [
						addon.imageUrl
							? el("img", { alt: addon.addonName, loading: "lazy", referrerpolicy: "no-referrer", src: addon.imageUrl })
							: el("div", { class: "addon-card__noimg" }, ["—"]),
					]),
					el("div", { class: "addon-card__body" }, [
						addon.groupLabel ? el("span", { class: "addon-card__group" }, [addon.groupLabel]) : null,
						el("p", { class: "addon-card__name" }, [addon.addonName]),
						addon.priceCents != null
							? el("span", { class: "addon-card__price" }, [formatCents(addon.priceCents)])
							: null,
					]),
					el(
						"bd-addon",
						{
							"data-add-url": addUrl,
							"data-product-id": addon.addonProductId,
							"data-variant-id": addonVariant(addon),
						},
						[el("button", { class: "bd-btn bd-btn--ghost addon-card__add", "data-bd-add": true, type: "button" }, ["Add"])],
					),
				]),
			),
		),
	]);
}

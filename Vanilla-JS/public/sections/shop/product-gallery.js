// [bd-file:store]
import { el } from "/bd.js";

/**
 * The product's photos: the one shown, ‹ and › to step through them, and a
 * thumbnail for each. There's a set of photos per variant with photos of its
 * own, besides the product's (`sets`, from photoSets()); `<bd-gallery>`
 * shows the chosen variant's set and changes the photo when a thumbnail or
 * arrow is pressed. `variantId` is the variant chosen when the page opens.
 */
export function productGallery({ productId, name, sets, variantId }) {
	const shown = sets.some((set) => set.variantId === variantId) ? variantId : "";
	return el(
		"bd-gallery",
		{ "data-product-id": productId },
		sets.map((set) => {
			const hidden = set.variantId !== shown;
			const many = set.photos.length > 1;
			return el("div", { class: "gallery", "data-bd-photos-for": set.variantId, hidden }, [
				el("div", { class: "gallery__main" }, [
					set.photos[0]
						? el("img", {
								alt: name,
								"data-bd-main": true,
								loading: hidden ? "lazy" : null,
								referrerpolicy: "no-referrer",
								src: set.photos[0],
							})
						: el("div", { class: "gallery__placeholder" }, ["No photo yet"]),
					many
						? el(
								"button",
								{
									"aria-label": "Previous photo",
									class: "gallery__step gallery__step--prev",
									"data-bd-step": "-1",
									type: "button",
								},
								["‹"],
							)
						: null,
					many
						? el(
								"button",
								{
									"aria-label": "Next photo",
									class: "gallery__step gallery__step--next",
									"data-bd-step": "1",
									type: "button",
								},
								["›"],
							)
						: null,
				]),
				many
					? el(
							"div",
							{ class: "gallery__thumbs" },
							set.photos.map((src, i) =>
								el(
									"button",
									{
										"aria-current": i === 0 ? "true" : "false",
										"aria-label": `Photo ${i + 1} of ${set.photos.length}`,
										class: `gallery__thumb${i === 0 ? " gallery__thumb--on" : ""}`,
										"data-bd-photo": String(i),
										type: "button",
									},
									[el("img", { alt: "", loading: "lazy", referrerpolicy: "no-referrer", src })],
								),
							),
						)
					: null,
			]);
		}),
	);
}

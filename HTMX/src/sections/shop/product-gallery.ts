// [bd-file:store]
import { html, type Raw } from "../../html";

/**
 * The product's photos: the one shown, ‹ and › to step through them, and a
 * thumbnail for each. There's a set of photos per variant with photos of its
 * own, besides the product's (`sets`, from photoSets()); `<bd-gallery>`
 * shows the chosen variant's set and changes the photo when a thumbnail or
 * arrow is pressed. `variantId` is the variant chosen when the page opens.
 */
export function productGallery(opts: {
	productId: string;
	name: string;
	sets: { variantId: string; photos: string[] }[];
	variantId: string;
}): Raw {
	const { productId, name, sets, variantId } = opts;
	const shown = sets.some((set) => set.variantId === variantId) ? variantId : "";
	return html`<bd-gallery data-product-id="${productId}">${sets.map((set) => {
		const hidden = set.variantId !== shown;
		const many = set.photos.length > 1;
		return html`<div class="gallery" data-bd-photos-for="${set.variantId}"${hidden ? html` hidden` : ""}>
			<div class="gallery__main">${
				set.photos[0]
					? html`<img alt="${name}" data-bd-main${hidden ? html` loading="lazy"` : ""} referrerpolicy="no-referrer" src="${set.photos[0]}" />`
					: html`<div class="gallery__placeholder">No photo yet</div>`
			}${
				many
					? html`<button aria-label="Previous photo" class="gallery__step gallery__step--prev" data-bd-step="-1" type="button">‹</button><button aria-label="Next photo" class="gallery__step gallery__step--next" data-bd-step="1" type="button">›</button>`
					: ""
			}</div>
			${
				many
					? html`<div class="gallery__thumbs">${set.photos.map(
							(src, i) =>
								html`<button aria-current="${i === 0 ? "true" : "false"}" aria-label="${`Photo ${i + 1} of ${set.photos.length}`}" class="gallery__thumb${i === 0 ? " gallery__thumb--on" : ""}" data-bd-photo="${String(i)}" type="button"><img alt="" loading="lazy" referrerpolicy="no-referrer" src="${src}" /></button>`,
						)}</div>`
					: ""
			}
		</div>`;
	})}</bd-gallery>`;
}

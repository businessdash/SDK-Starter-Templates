// [bd-file:store]
import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, computed, input } from "@angular/core";

/**
 * The product's photos: the one shown, ‹ and › to step through them, and a
 * thumbnail for each. There's a set of photos per variant with photos of its
 * own, besides the product's; `<bd-gallery>` shows the chosen variant's set
 * and changes the photo when a thumbnail or arrow is pressed.
 */
@Component({
	selector: "bd-product-gallery",
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: ":host { display: contents; }",
	template: `
		<bd-gallery [attr.data-product-id]="productId()">
			@for (set of sets(); track set.variantId) {
				<div class="gallery" [attr.data-bd-photos-for]="set.variantId" [hidden]="set.variantId !== shown()">
					<div class="gallery__main">
						@if (set.photos[0]; as first) {
							<img
								data-bd-main
								referrerpolicy="no-referrer"
								[alt]="name()"
								[attr.loading]="set.variantId !== shown() ? 'lazy' : null"
								[src]="first"
							/>
						} @else {
							<div class="gallery__placeholder">No photo yet</div>
						}
						@if (set.photos.length > 1) {
							<button
								aria-label="Previous photo"
								class="gallery__step gallery__step--prev"
								data-bd-step="-1"
								type="button"
							>
								‹
							</button>
							<button aria-label="Next photo" class="gallery__step gallery__step--next" data-bd-step="1" type="button">
								›
							</button>
						}
					</div>
					@if (set.photos.length > 1) {
						<div class="gallery__thumbs">
							@for (src of set.photos; track src; let i = $index) {
								<button
									class="gallery__thumb"
									type="button"
									[attr.aria-current]="i === 0 ? 'true' : 'false'"
									[attr.aria-label]="'Photo ' + (i + 1) + ' of ' + set.photos.length"
									[attr.data-bd-photo]="i"
									[class.gallery__thumb--on]="i === 0"
								>
									<img alt="" loading="lazy" referrerpolicy="no-referrer" [src]="src" />
								</button>
							}
						</div>
					}
				</div>
			}
		</bd-gallery>
	`,
})
export class ProductGalleryComponent {
	readonly productId = input.required<string>();
	readonly name = input.required<string>();
	/** From photoSets(): the product's photos (variantId ""), then each variant's own. */
	readonly sets = input.required<{ variantId: string; photos: string[] }[]>();
	/** The variant chosen when the page opens. */
	readonly variantId = input.required<string>();

	readonly shown = computed(() =>
		this.sets().some((set) => set.variantId === this.variantId()) ? this.variantId() : "",
	);
}

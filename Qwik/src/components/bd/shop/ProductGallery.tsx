// [bd-file:store]
/**
 * The product's photos: the one shown, ‹ and › to step through them, and a
 * thumbnail for each. There's a set of photos per variant with photos of its
 * own, besides the product's; `<bd-gallery>` shows the chosen variant's set
 * and changes the photo when a thumbnail or arrow is pressed.
 */
export function ProductGallery({
	productId,
	name,
	sets,
	variantId,
}: {
	productId: string;
	name: string;
	/** From photoSets(): the product's photos (variantId ""), then each variant's own. */
	sets: { variantId: string; photos: string[] }[];
	/** The variant chosen when the page opens. */
	variantId: string;
}) {
	const shown = sets.some((set) => set.variantId === variantId) ? variantId : "";
	return (
		<bd-gallery data-product-id={productId} key={productId}>
			{sets.map((set) => {
				const hidden = set.variantId !== shown;
				return (
					<div class="gallery" data-bd-photos-for={set.variantId} hidden={hidden} key={set.variantId}>
						<div class="gallery__main">
							{set.photos[0] ? (
								<img
									alt={name}
									data-bd-main=""
									loading={hidden ? "lazy" : undefined}
									referrerPolicy="no-referrer"
									src={set.photos[0]}
								/>
							) : (
								<div class="gallery__placeholder">No photo yet</div>
							)}
							{set.photos.length > 1 ? (
								<>
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
								</>
							) : null}
						</div>
						{set.photos.length > 1 ? (
							<div class="gallery__thumbs">
								{set.photos.map((src, i) => (
									<button
										aria-current={i === 0 ? "true" : "false"}
										aria-label={`Photo ${i + 1} of ${set.photos.length}`}
										class={`gallery__thumb${i === 0 ? " gallery__thumb--on" : ""}`}
										data-bd-photo={String(i)}
										key={src}
										type="button"
									>
										<img alt="" loading="lazy" referrerPolicy="no-referrer" src={src} />
									</button>
								))}
							</div>
						) : null}
					</div>
				);
			})}
		</bd-gallery>
	);
}

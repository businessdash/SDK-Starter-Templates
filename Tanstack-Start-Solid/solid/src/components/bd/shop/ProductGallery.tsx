// [bd-file:store]
import { For, Show } from "solid-js";

/**
 * The product's photos: the one shown, ‹ and › to step through them, and a
 * thumbnail for each. There's a set of photos per variant with photos of its
 * own, besides the product's; `<bd-gallery>` shows the chosen variant's set
 * and changes the photo when a thumbnail or arrow is pressed.
 */
export function ProductGallery(props: {
	productId: string;
	name: string;
	/** From photoSets(): the product's photos (variantId ""), then each variant's own. */
	sets: { variantId: string; photos: string[] }[];
	/** The variant chosen when the page opens. */
	variantId: string;
}) {
	const shown = () =>
		props.sets.some((set) => set.variantId === props.variantId)
			? props.variantId
			: "";
	return (
		<bd-gallery data-product-id={props.productId}>
			<For each={props.sets}>
				{(set) => (
					<PhotoSet
						hidden={set.variantId !== shown()}
						name={props.name}
						photos={set.photos}
						variantId={set.variantId}
					/>
				)}
			</For>
		</bd-gallery>
	);
}

function PhotoSet(props: {
	variantId: string;
	photos: string[];
	name: string;
	hidden: boolean;
}) {
	return (
		<div
			class="gallery"
			data-bd-photos-for={props.variantId}
			hidden={props.hidden}
		>
			<div class="gallery__main">
				<Show
					when={props.photos[0]}
					fallback={<div class="gallery__placeholder">No photo yet</div>}
				>
					{(src) => (
						<img
							alt={props.name}
							data-bd-main
							loading={props.hidden ? "lazy" : undefined}
							referrerpolicy="no-referrer"
							src={src()}
						/>
					)}
				</Show>
				<Show when={props.photos.length > 1}>
					<button
						aria-label="Previous photo"
						class="gallery__step gallery__step--prev"
						data-bd-step="-1"
						type="button"
					>
						‹
					</button>
					<button
						aria-label="Next photo"
						class="gallery__step gallery__step--next"
						data-bd-step="1"
						type="button"
					>
						›
					</button>
				</Show>
			</div>
			<Show when={props.photos.length > 1}>
				<div class="gallery__thumbs">
					<For each={props.photos}>
						{(src, i) => (
							<button
								aria-current={i() === 0 ? "true" : "false"}
								aria-label={`Photo ${i() + 1} of ${props.photos.length}`}
								class={`gallery__thumb${i() === 0 ? " gallery__thumb--on" : ""}`}
								data-bd-photo={i()}
								type="button"
							>
								<img
									alt=""
									loading="lazy"
									referrerpolicy="no-referrer"
									src={src}
								/>
							</button>
						)}
					</For>
				</div>
			</Show>
		</div>
	);
}

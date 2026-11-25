// [bd-file:store]
/**
 * The product's photos: the one shown, ‹ and › to step through them, and a
 * thumbnail for each. `index` is the photo shown; the page keeps it, so
 * choosing another style can go back to that style's first photo.
 */
export function ProductGallery({
	photos,
	name,
	index,
	onIndexChange,
}: {
	photos: string[];
	/** The product's name, the shown photo's alt text. */
	name: string;
	index: number;
	onIndexChange: (index: number) => void;
}) {
	const step = (by: number) =>
		onIndexChange((index + by + photos.length) % photos.length);
	return (
		<div className="gallery">
			<div className="gallery__main">
				{photos[index] ? (
					<img alt={name} referrerPolicy="no-referrer" src={photos[index]} />
				) : (
					<div className="gallery__placeholder">No photo yet</div>
				)}
				{photos.length > 1 && (
					<>
						<button
							aria-label="Previous photo"
							className="gallery__step gallery__step--prev"
							onClick={() => step(-1)}
							type="button"
						>
							‹
						</button>
						<button
							aria-label="Next photo"
							className="gallery__step gallery__step--next"
							onClick={() => step(1)}
							type="button"
						>
							›
						</button>
					</>
				)}
			</div>
			{photos.length > 1 && (
				<div className="gallery__thumbs">
					{photos.map((src, i) => (
						<button
							aria-current={i === index}
							aria-label={`Photo ${i + 1} of ${photos.length}`}
							className={`gallery__thumb${i === index ? " gallery__thumb--on" : ""}`}
							key={`${src}${i}`}
							onClick={() => onIndexChange(i)}
							type="button"
						>
							<img
								alt=""
								loading="lazy"
								referrerPolicy="no-referrer"
								src={src}
							/>
						</button>
					))}
				</div>
			)}
		</div>
	);
}

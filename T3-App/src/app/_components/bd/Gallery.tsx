import type { GalleryItem } from "@/server/api/routers/bd";

export function Gallery({ items }: { items: GalleryItem[] }) {
	return (
		<section className="bd-section" id="gallery">
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Recent work</span>
				<h2 className="bd-section__title">Gallery</h2>
				<p className="bd-section__sub">
					Pulled live from the BD gallery surface. Each tile only fetches the
					fields it actually displays.
				</p>
			</div>
			{items.length === 0 ? (
				<div className="bd-empty">
					No gallery items yet. Add a few in BD and they'll appear here.
				</div>
			) : (
				<div className="bd-grid-4">
					{items.map((item) => (
						<div className="bd-card gallery-tile" key={item.id}>
							{item.src ? (
								// eslint-disable-next-line @next/next/no-img-element
								<img
									alt={item.title ?? item.category ?? "Gallery item"}
									loading="lazy"
									src={item.src}
									style={
										item.blurDataURL
											? {
													backgroundImage: `url(${item.blurDataURL})`,
													backgroundSize: "cover",
												}
											: undefined
									}
								/>
							) : null}
							{item.title || item.category ? (
								<div className="gallery-tile__caption">
									{item.title ?? item.category}
								</div>
							) : null}
						</div>
					))}
				</div>
			)}
		</section>
	);
}

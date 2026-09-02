import { For, Show } from "solid-js";

import type { GalleryItem } from "../../lib/biab-server-fns";

export function Gallery(props: { items: GalleryItem[] }) {
	return (
		<section class="biab-section" id="gallery">
			<div class="biab-section__lead">
				<span class="biab-section__eyebrow">Recent work</span>
				<h2 class="biab-section__title">Gallery</h2>
				<p class="biab-section__sub">
					Pulled live from the BIAB gallery surface. Each tile only fetches the
					fields it actually displays.
				</p>
			</div>
			<Show
				when={props.items.length > 0}
				fallback={
					<div class="biab-empty">
						No gallery items yet. Add a few in BIAB and they'll appear here.
					</div>
				}
			>
				<div class="biab-grid-4">
					<For each={props.items}>
						{(item) => (
							<div class="biab-card gallery-tile">
								<Show when={item.src}>
									<img
										alt={item.title ?? item.category ?? "Gallery item"}
										loading="lazy"
										src={item.src ?? ""}
										style={
											item.blurDataURL
												? `background-image: url(${item.blurDataURL}); background-size: cover;`
												: undefined
										}
									/>
								</Show>
								<Show when={item.title || item.category}>
									<div class="gallery-tile__caption">
										{item.title ?? item.category}
									</div>
								</Show>
							</div>
						)}
					</For>
				</div>
			</Show>
		</section>
	);
}

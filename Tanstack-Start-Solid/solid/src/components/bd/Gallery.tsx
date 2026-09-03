import { For, Show } from "solid-js";

import type { GalleryItem } from "../../lib/bd-server-fns";

export function Gallery(props: { items: GalleryItem[] }) {
	return (
		<section class="bd-section" id="gallery">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">Recent work</span>
				<h2 class="bd-section__title">Gallery</h2>
				<p class="bd-section__sub">
					Pulled live from the BD gallery surface. Each tile only fetches the
					fields it actually displays.
				</p>
			</div>
			<Show
				when={props.items.length > 0}
				fallback={
					<div class="bd-empty">
						No gallery items yet. Add a few in BD and they'll appear here.
					</div>
				}
			>
				<div class="bd-grid-4">
					<For each={props.items}>
						{(item) => (
							<div class="bd-card gallery-tile">
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

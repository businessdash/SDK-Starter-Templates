// [bd-file:store]
import { For, Show } from "solid-js";

import { formatCents, type SavedProduct } from "../../../lib/shop/shop";

/** A row of small product cards: related products. */
export function ProductRail(props: {
	title: string;
	products: SavedProduct[];
	storeHref?: string;
}) {
	return (
		<Show when={props.products.length > 0}>
			<section class="product-rail">
				<h2 class="product-rail__title">{props.title}</h2>
				<ul class="product-rail__row">
					<For each={props.products}>
						{(product) => (
							<li>
								<a
									class="bd-card product-rail__card"
									href={`${props.storeHref ?? "/store"}/${encodeURIComponent(product.id)}`}
								>
									<Show
										when={product.image}
										fallback={
											<span aria-hidden="true" class="product-rail__noimg" />
										}
									>
										{(src) => (
											<img
												alt=""
												loading="lazy"
												referrerpolicy="no-referrer"
												src={src()}
											/>
										)}
									</Show>
									<span class="product-rail__name">{product.name}</span>
									<Show when={product.priceCents != null}>
										<span class="product-rail__price">
											{formatCents(product.priceCents ?? 0)}
										</span>
									</Show>
								</a>
							</li>
						)}
					</For>
				</ul>
			</section>
		</Show>
	);
}

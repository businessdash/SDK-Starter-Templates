import { createFileRoute, Link, useNavigate } from "@tanstack/solid-router";
import { createSignal, For, Show } from "solid-js";

import { formatMoney, rowImage, rowPriceCents } from "../components/bd/money";
import { Stars } from "../components/bd/Stars";
import {
	addToCart,
	getStoreProduct,
	getStoreProductExtras,
} from "../lib/bd-server-fns";

/**
 * Storefront product detail. The loader resolves the full product via
 * `storefront.getProduct` and, in parallel, its reviews / related / addons via
 * `getStoreProductExtras`. "Add to cart" calls the `addToCart` server fn — the
 * visitor-token cookie is minted server-side on that first write.
 */
export const Route = createFileRoute("/store/$id")({
	component: StoreDetail,
	loader: async ({ params }) => {
		const [product, extras] = await Promise.all([
			getStoreProduct({ data: { id: params.id } }),
			getStoreProductExtras({ data: { id: params.id } }),
		]);
		return { product, extras };
	},
});

function asString(v: unknown): string {
	return typeof v === "string" ? v : "";
}

function StoreDetail() {
	const data = Route.useLoaderData();
	const result = () => data().product;
	const extras = () => data().extras;
	const navigate = useNavigate();
	const [busy, setBusy] = createSignal(false);
	const [msg, setMsg] = createSignal<string | null>(null);
	const reason = () => {
		const r = result();
		return r.ok ? null : r.reason;
	};

	async function handleAdd(productId: string) {
		setBusy(true);
		setMsg(null);
		const res = await addToCart({ data: { productId, quantity: 1 } });
		setBusy(false);
		if (res.ok) {
			navigate({ to: "/store/cart" });
		} else {
			setMsg(res.error);
		}
	}

	return (
		<main>
			<section class="bd-section bd-section--narrow">
				<Link
					class="bd-section__eyebrow"
					style="display: inline-block; margin-bottom: 1rem;"
					to="/store"
				>
					← Back to store
				</Link>

				<Show
					when={result().ok}
					fallback={
						<div class="bd-empty">
							<Show
								when={reason() === "suspended"}
								fallback={<>This product is unavailable.</>}
							>
								This store is temporarily unavailable. Please check back soon.
							</Show>
						</div>
					}
				>
					{(() => {
						const r = result();
						if (!r.ok) return null;
						const product = r.product as typeof r.product &
							Record<string, unknown>;
						const price = rowPriceCents(product);
						const img = rowImage(product);
						const description =
							typeof product.description === "string"
								? product.description
								: null;
						const reviews = () => extras().reviews;
						return (
							<>
								<div class="bd-card" style="padding: 1.5rem;">
									<Show when={img}>
										<img
											alt={product.name}
											src={img ?? ""}
											style="aspect-ratio: 16/9; object-fit: cover; border-radius: 0.6rem; margin-bottom: 1.25rem;"
										/>
									</Show>
									<h1 class="bd-section__title" style="text-align: left;">
										{product.name}
									</h1>
									<Show when={reviews() && (reviews()?.totalCount ?? 0) > 0}>
										<div style="display: flex; align-items: center; gap: 0.5rem; margin-top: 0.5rem;">
											<Stars rating={reviews()?.avgRating ?? 0} />
											<span style="color: var(--text-muted); font-size: 0.9rem;">
												{(reviews()?.avgRating ?? 0).toFixed(1)} (
												{reviews()?.totalCount})
											</span>
										</div>
									</Show>
									<Show when={price != null}>
										<div
											class="service-card__price"
											style="font-size: 1.25rem; margin: 0.75rem 0 1rem;"
										>
											{formatMoney(price ?? 0)}
										</div>
									</Show>
									<Show when={description}>
										<p style="margin-bottom: 1.5rem;">{description}</p>
									</Show>
									<button
										class="bd-btn"
										disabled={busy()}
										onClick={() => handleAdd(product.id)}
										type="button"
									>
										{busy() ? "Adding…" : "Add to cart"}
									</button>
									<Show when={msg()}>
										<div style="margin-top: 1rem; color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
											{msg()}
										</div>
									</Show>
								</div>

								{/* Addons — complete your purchase */}
								<Show when={extras().addons.length > 0}>
									<section class="store-section">
										<h2 class="store-section__title">Complete your purchase</h2>
										<div class="bd-grid-3">
											<For each={extras().addons}>
												{(a) => (
													<Link
														class="bd-card store-addon"
														params={{ id: a.addonProductId }}
														style="text-decoration: none; border-bottom: none;"
														to="/store/$id"
													>
														<Show when={a.imageUrl}>
															<img alt={a.addonName} src={a.imageUrl ?? ""} />
														</Show>
														<div>
															<div class="store-addon__name">{a.addonName}</div>
															<Show when={a.priceCents != null}>
																<div class="store-addon__price">
																	{formatMoney(a.priceCents ?? 0)}
																</div>
															</Show>
														</div>
													</Link>
												)}
											</For>
										</div>
									</section>
								</Show>

								{/* Reviews */}
								<Show when={(reviews()?.items.length ?? 0) > 0}>
									<section class="store-section">
										<h2 class="store-section__title">Reviews</h2>
										<For each={reviews()?.items ?? []}>
											{(rev) => {
												const review = rev as Record<string, unknown>;
												const name =
													asString(review.reviewerName) || "Verified buyer";
												const text =
													asString(review.content) || asString(review.body);
												const title = asString(review.title);
												const rating = Number(review.rating) || 0;
												return (
													<div class="store-review">
														<div class="store-review__head">
															<Stars rating={rating} />
															<span class="store-review__name">{name}</span>
														</div>
														<Show when={title}>
															<p class="store-review__title">{title}</p>
														</Show>
														<Show when={text}>
															<p class="store-review__body">{text}</p>
														</Show>
													</div>
												);
											}}
										</For>
									</section>
								</Show>

								{/* Related — you may also like */}
								<Show when={extras().related.length > 0}>
									<section class="store-section">
										<h2 class="store-section__title">You may also like</h2>
										<div class="bd-grid-3">
											<For each={extras().related}>
												{(rp) => (
													<Link
														class="bd-card store-card"
														params={{ id: rp.id }}
														style="text-decoration: none; border-bottom: none;"
														to="/store/$id"
													>
														<div class="store-card__media">
															<Show when={rp.coverImageUrl}>
																<img
																	alt={rp.name}
																	src={rp.coverImageUrl ?? ""}
																/>
															</Show>
														</div>
														<div class="store-card__body">
															<h3>{rp.name}</h3>
															<Show when={rp.minPriceDollars != null}>
																<div class="store-card__price">
																	<span class="store-card__price-now">
																		{formatMoney(
																			Math.round(
																				(rp.minPriceDollars ?? 0) * 100,
																			),
																		)}
																	</span>
																</div>
															</Show>
														</div>
													</Link>
												)}
											</For>
										</div>
									</section>
								</Show>
							</>
						);
					})()}
				</Show>
			</section>
		</main>
	);
}

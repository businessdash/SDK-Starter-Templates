import type { StorefrontSort } from "@businessdash/sdk/contracts";
import { createFileRoute, Link } from "@tanstack/solid-router";
import { createMemo, createResource, createSignal, For, Show } from "solid-js";

import { formatMoney } from "../components/bd/money";
import { Stars } from "../components/bd/Stars";
import {
	getStoreListing,
	type StoreFilters,
	type StoreListingResult,
} from "../lib/bd-server-fns";

/**
 * Storefront listing — `storefront.listProductsWithMeta` powers an enriched,
 * platform-style grid (price / compareAt / ratings / badges) with a facet
 * sidebar (search, categories with counts, price range, min-rating, sort).
 *
 * The loader fetches the unfiltered first page server-side; facet changes drive
 * a `createResource` that refetches through the same `getStoreListing` server fn
 * (the secret key stays on the server). Degrades to a "not connected" /
 * "unavailable" state when BD env is unset or the org is suspended.
 */
export const Route = createFileRoute("/store/")({
	component: StoreIndex,
	loader: () => getStoreListing({ data: {} }),
});

const SORT_LABELS: Record<StorefrontSort, string> = {
	featured: "Featured",
	newest: "Newest",
	"price-asc": "Price: low to high",
	"price-desc": "Price: high to low",
	"rating-desc": "Top rated",
};

function StoreIndex() {
	const initial = Route.useLoaderData();

	const [filters, setFilters] = createSignal<StoreFilters>({});

	// Refetch through the server fn whenever a facet changes. Seeded with the
	// loader's first page so there's no flash before the first interaction.
	const [listing] = createResource<StoreListingResult, StoreFilters>(
		filters,
		(f) => getStoreListing({ data: f }),
		{ initialValue: initial() },
	);

	const result = () => listing() ?? initial();
	const data = () => {
		const r = result();
		return r.ok ? r : null;
	};
	const reason = () => {
		const r = result();
		return r.ok ? null : r.reason;
	};

	const countByCategory = createMemo(() => {
		const d = data();
		return new Map(
			(d?.categoryCounts ?? []).map((c) => [c.categoryId, c.count]),
		);
	});

	const patch = (next: Partial<StoreFilters>) =>
		setFilters((prev) => ({ ...prev, ...next }));

	const hasFilters = () => {
		const f = filters();
		return Boolean(
			f.search ||
				f.categoryId ||
				f.minRating ||
				f.minPriceCents != null ||
				f.maxPriceCents != null,
		);
	};

	const onSearch = (e: SubmitEvent) => {
		e.preventDefault();
		const q = String(
			new FormData(e.currentTarget as HTMLFormElement).get("q") ?? "",
		).trim();
		patch({ search: q || undefined });
	};

	const onPrice = (e: SubmitEvent) => {
		e.preventDefault();
		const fd = new FormData(e.currentTarget as HTMLFormElement);
		const min = Number(String(fd.get("min") ?? "").trim());
		const max = Number(String(fd.get("max") ?? "").trim());
		patch({
			minPriceCents:
				Number.isFinite(min) && min > 0 ? Math.round(min * 100) : undefined,
			maxPriceCents:
				Number.isFinite(max) && max > 0 ? Math.round(max * 100) : undefined,
		});
	};

	return (
		<main>
			<section class="bd-section">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Shop</span>
					<h1 class="bd-section__title">Store</h1>
					<p class="bd-section__sub">
						Products synced live from BD. Filter, add to cart, apply a coupon,
						and check out through Stripe.
					</p>
				</div>

				<Show
					when={data()}
					fallback={
						<div class="bd-empty">
							<Show
								when={reason() === "suspended"}
								fallback={
									<>
										Store isn't connected yet. Set <code>BD_API_KEY</code>,{" "}
										<code>BD_SITE_ID</code>, and{" "}
										<code>BD_PACKAGE_API_BASE_URL</code> in <code>.env</code>.
									</>
								}
							>
								This store is temporarily unavailable. Please check back soon.
							</Show>
						</div>
					}
				>
					{(d) => (
						<div class="store-layout">
							{/* Facet sidebar */}
							<aside class="store-sidebar">
								<form onSubmit={onSearch}>
									<div class="store-facet__title">Search</div>
									<input
										class="bd-input"
										name="q"
										placeholder="Search products…"
										type="search"
										value={filters().search ?? ""}
									/>
								</form>

								<Show when={d().categories.length > 0}>
									<div>
										<div class="store-facet__title">Category</div>
										<ul class="store-facet__list">
											<li>
												<button
													class="store-facet__btn"
													classList={{
														"store-facet__btn--active": !filters().categoryId,
													}}
													onClick={() => patch({ categoryId: undefined })}
													type="button"
												>
													All products
												</button>
											</li>
											<For each={d().categories}>
												{(c) => {
													const active = () => filters().categoryId === c.id;
													return (
														<li>
															<button
																class="store-facet__btn"
																classList={{
																	"store-facet__btn--active": active(),
																}}
																onClick={() =>
																	patch({
																		categoryId: active() ? undefined : c.id,
																	})
																}
																type="button"
															>
																<span>{c.name}</span>
																<span class="store-facet__count">
																	{countByCategory().get(c.id) ?? 0}
																</span>
															</button>
														</li>
													);
												}}
											</For>
										</ul>
									</div>
								</Show>

								<form onSubmit={onPrice}>
									<div class="store-facet__title">Price</div>
									<div class="store-facet__price">
										<input
											class="bd-input"
											inputmode="numeric"
											name="min"
											placeholder={`$${Math.floor(d().priceRange.minDollars)}`}
										/>
										<span>–</span>
										<input
											class="bd-input"
											inputmode="numeric"
											name="max"
											placeholder={`$${Math.ceil(d().priceRange.maxDollars)}`}
										/>
									</div>
									<button
										class="bd-btn bd-btn--ghost"
										style="margin-top: 0.5rem; width: 100%;"
										type="submit"
									>
										Apply
									</button>
								</form>

								<div>
									<div class="store-facet__title">Rating</div>
									<ul class="store-facet__list">
										<For each={[4, 3, 2]}>
											{(r) => {
												const active = () => filters().minRating === r;
												return (
													<li>
														<button
															class="store-facet__btn"
															classList={{
																"store-facet__btn--active": active(),
															}}
															onClick={() =>
																patch({ minRating: active() ? undefined : r })
															}
															type="button"
														>
															<span style="display: inline-flex; align-items: center; gap: 0.4rem;">
																<Stars rating={r} /> &amp; up
															</span>
														</button>
													</li>
												);
											}}
										</For>
									</ul>
								</div>

								<Show when={hasFilters()}>
									<button
										class="store-facet__btn store-facet__btn--active"
										onClick={() => setFilters({})}
										type="button"
									>
										Clear all filters
									</button>
								</Show>
							</aside>

							{/* Grid */}
							<div>
								<div class="store-toolbar">
									<span class="store-toolbar__count">
										{d().items.length}{" "}
										{d().items.length === 1 ? "product" : "products"}
										<Show when={listing.loading}> · updating…</Show>
									</span>
									<label style="display: inline-flex; align-items: center; gap: 0.5rem; font-size: 0.9rem; color: var(--text-muted);">
										<span>Sort</span>
										<select
											class="bd-input bd-select"
											onChange={(e) =>
												patch({
													sort:
														e.currentTarget.value === "featured"
															? undefined
															: (e.currentTarget.value as StorefrontSort),
												})
											}
											style="width: auto;"
											value={filters().sort ?? "featured"}
										>
											<For
												each={Object.keys(SORT_LABELS) as Array<StorefrontSort>}
											>
												{(s) => <option value={s}>{SORT_LABELS[s]}</option>}
											</For>
										</select>
									</label>
								</div>

								<Show
									when={d().items.length > 0}
									fallback={
										<div class="bd-empty">
											No products match these filters. Try clearing one or
											broadening your search.
										</div>
									}
								>
									<div class="bd-grid-3">
										<For each={d().items}>
											{(p) => (
												<Link
													class="bd-card store-card"
													params={{ id: p.id }}
													style="text-decoration: none; border-bottom: none;"
													to="/store/$id"
												>
													<div class="store-card__media">
														<Show when={p.coverImage}>
															<img alt={p.name} src={p.coverImage ?? ""} />
														</Show>
														<div class="store-card__badges">
															<Show when={p.isBestSeller}>
																<span class="store-badge store-badge--featured">
																	Best seller
																</span>
															</Show>
															<Show when={p.isNew}>
																<span class="store-badge store-badge--new">
																	New
																</span>
															</Show>
															<Show when={p.isOnSale}>
																<span class="store-badge store-badge--sale">
																	Sale
																</span>
															</Show>
														</div>
													</div>
													<div class="store-card__body">
														<h3>{p.name}</h3>
														<Show when={p.reviewCount > 0}>
															<div class="store-card__rating">
																<Stars rating={p.avgRating} />
																<span>({p.reviewCount})</span>
															</div>
														</Show>
														<div class="store-card__price">
															<Show when={p.cheapestPriceCents != null}>
																<span class="store-card__price-now">
																	{p.hasMultipleVariants ? "From " : ""}
																	{formatMoney(p.cheapestPriceCents ?? 0)}
																</span>
															</Show>
															<Show
																when={p.isOnSale && p.comparePriceCents != null}
															>
																<span class="store-card__price-was">
																	{formatMoney(p.comparePriceCents ?? 0)}
																</span>
															</Show>
														</div>
														<Show when={p.isLowStock}>
															<span class="store-card__lowstock">
																Low stock
															</span>
														</Show>
													</div>
												</Link>
											)}
										</For>
									</div>
								</Show>
							</div>
						</div>
					)}
				</Show>

				<div style="margin-top: 2rem; display: flex; gap: 0.75rem;">
					<Link class="bd-btn bd-btn--ghost" to="/store/cart">
						View cart
					</Link>
					<Link class="bd-btn bd-btn--ghost" to="/subscriptions">
						Subscriptions
					</Link>
				</div>
			</section>
		</main>
	);
}

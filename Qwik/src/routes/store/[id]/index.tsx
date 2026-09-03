import { $, component$, useSignal } from "@builder.io/qwik";
import {
	type DocumentHead,
	Link,
	routeLoader$,
	server$,
	useNavigate,
} from "@builder.io/qwik-city";

import {
	BdPaymentLapsedError,
	BdServiceSuspendedError,
} from "@businessdash/sdk";
import type {
	StorefrontAddon,
	StorefrontProductDetail,
	StorefrontRelatedProduct,
	StorefrontReview,
} from "@businessdash/sdk/contracts";

import { Footer } from "../../../components/bd/Footer";
import { SiteHeader } from "../../../components/bd/SiteHeader";
import { Stars } from "../../../components/bd/Stars";
import { getBd } from "../../../lib/bd";
import {
	addToCart,
	formatMoney,
	getCartSnapshot,
	getStoreProductAddons,
	getStoreProductReviews,
	getStoreRelatedProducts,
} from "../../../lib/bd-store";
import { getCustomerSession } from "../../../lib/bd-portal";

/** A variant row is an untyped passthrough record; pull the fields we render. */
type Variant = {
	id?: string;
	title?: string | null;
	priceCents?: number | null;
	currency?: string | null;
	isLive?: boolean;
};

export const useProduct = routeLoader$(async ({ params, cookie, status }) => {
	const bd = getBd();
	const empty = {
		configured: false,
		suspended: false,
		product: null as StorefrontProductDetail | null,
		reviews: { items: [] as StorefrontReview[], avgRating: 0, totalCount: 0 },
		addons: [] as StorefrontAddon[],
		related: [] as StorefrontRelatedProduct[],
		cartCount: 0,
		signedIn: false,
	} as const;

	if (!bd) return empty;
	try {
		const [product, reviews, addons, related, cart, session] =
			await Promise.all([
				bd.storefront.getProduct(params.id),
				getStoreProductReviews(params.id, { limit: 20 }),
				getStoreProductAddons(params.id),
				getStoreRelatedProducts(params.id, { limit: 6 }),
				getCartSnapshot(cookie),
				getCustomerSession(cookie),
			]);
		return {
			configured: true,
			suspended: false,
			product: product as StorefrontProductDetail,
			reviews: reviews
				? {
						items: reviews.items,
						avgRating: reviews.avgRating,
						totalCount: reviews.totalCount,
					}
				: { items: [], avgRating: 0, totalCount: 0 },
			addons: addons?.items ?? [],
			related: related?.items ?? [],
			cartCount: cart?.itemCount ?? 0,
			signedIn: !!session,
		} as const;
	} catch (err) {
		if (
			err instanceof BdServiceSuspendedError ||
			err instanceof BdPaymentLapsedError
		) {
			return { ...empty, configured: true, suspended: true } as const;
		}
		status(404);
		return { ...empty, configured: true } as const;
	}
});

/**
 * Server RPC: add a (product, variant) to the visitor cart. `this` is the
 * RequestEvent, so we read/write the `bd_cart_visitor` cookie through it.
 * Mutations mint the cookie on first use inside `addToCart`.
 */
const addToCartRpc = server$(async function (
	this,
	input: { productId: string; variantId: string | null; quantity: number },
) {
	return await addToCart(this.cookie, input);
});

export default component$(() => {
	const data = useProduct();
	const nav = useNavigate();
	const product = data.value.product as StorefrontProductDetail | null;
	const variants = (product?.variants ?? []) as Variant[];
	const selectedVariant = useSignal<string>(variants[0]?.id ?? "");
	const adding = useSignal(false);
	const error = useSignal<string | null>(null);

	const handleAdd = $(async () => {
		if (!product) return;
		adding.value = true;
		error.value = null;
		const res = await addToCartRpc({
			productId: product.id,
			variantId: selectedVariant.value || null,
			quantity: 1,
		});
		adding.value = false;
		if (res.ok) {
			await nav("/cart");
		} else {
			error.value = res.error;
		}
	});

	const addToCartProduct = $(async (productId: string) => {
		const res = await addToCartRpc({ productId, variantId: null, quantity: 1 });
		if (res.ok) await nav("/cart");
		else error.value = res.error;
	});

	const image = product?.images?.[0] ?? null;
	const reviews = data.value.reviews;
	const addons = data.value.addons;
	const related = data.value.related;

	return (
		<>
			<SiteHeader signedIn={data.value.signedIn} cartCount={data.value.cartCount} />
			<main>
				<section class="bd-section bd-section--narrow">
					{data.value.suspended ? (
						<div class="bd-empty">
							The store is temporarily unavailable. Please check back soon.
						</div>
					) : !product ? (
						<div class="bd-empty">
							Product not found, or the store isn't connected yet.
						</div>
					) : (
						<div class="bd-card" style="padding: 2rem; display: flex; flex-direction: column; gap: 1.25rem;">
							{image ? (
								<img
									alt={product.name}
									src={image}
									style="border-radius: 1rem; aspect-ratio: 4/3; object-fit: cover;"
								/>
							) : null}
							<h1 class="bd-section__title">{product.name}</h1>

							{reviews.totalCount > 0 ? (
								<div class="store-card__rating">
									<Stars rating={reviews.avgRating} />
									<span class="store-card__reviews">
										{reviews.avgRating.toFixed(1)} · {reviews.totalCount}{" "}
										{reviews.totalCount === 1 ? "review" : "reviews"}
									</span>
								</div>
							) : null}

							{variants.length > 1 ? (
								<div>
									<label class="bd-label" for="variant">
										Option
									</label>
									<select
										bind:value={selectedVariant}
										class="bd-select"
										id="variant"
									>
										{variants.map((v, i) => (
											<option key={v.id ?? i} value={v.id ?? ""}>
												{`${v.title ?? `Option ${i + 1}`}${
													typeof v.priceCents === "number"
														? ` · ${formatMoney(v.priceCents, v.currency ?? "usd")}`
														: ""
												}`}
											</option>
										))}
									</select>
								</div>
							) : variants[0] && typeof variants[0].priceCents === "number" ? (
								<div class="service-card__price">
									{formatMoney(
										variants[0].priceCents,
										variants[0].currency ?? "usd",
									)}
								</div>
							) : null}

							<button
								class="bd-btn"
								disabled={adding.value}
								onClick$={handleAdd}
								style="align-self: flex-start;"
								type="button"
							>
								{adding.value ? "Adding…" : "Add to cart"}
							</button>

							{error.value ? (
								<div style="color: var(--danger); background: var(--danger-bg); padding: 0.75rem 1rem; border-radius: 0.5rem; font-size: 0.9rem;">
									{error.value}
								</div>
							) : null}
						</div>
					)}

					{/* Addons rail — companion / cross-sell ("complete your X") */}
					{product && addons.length > 0 ? (
						<div class="store-detail__block">
							<h2 class="store-detail__heading">Complete your purchase</h2>
							<div class="store-addons">
								{addons.map((a) => (
									<div class="bd-card store-addon" key={a.id}>
										{a.imageUrl ? (
											<img
												alt={a.addonName}
												class="store-addon__img"
												loading="lazy"
												referrerPolicy="no-referrer"
												src={a.imageUrl}
											/>
										) : null}
										<div class="store-addon__body">
											{a.groupLabel ? (
												<span class="bd-badge">{a.groupLabel}</span>
											) : null}
											<h3 class="store-addon__name">{a.addonName}</h3>
											{a.addonDescription ? (
												<p class="store-addon__desc">{a.addonDescription}</p>
											) : null}
											<div class="store-card__price">
												{a.priceCents != null ? (
													<span class="service-card__price">
														{formatMoney(a.priceCents, "usd")}
													</span>
												) : null}
												{a.originalPriceCents != null &&
												a.priceCents != null &&
												a.originalPriceCents > a.priceCents ? (
													<span class="store-card__compare">
														{formatMoney(a.originalPriceCents, "usd")}
													</span>
												) : null}
											</div>
											<button
												class="bd-btn bd-btn--ghost"
												onClick$={() => addToCartProduct(a.addonProductId)}
												style="align-self: flex-start;"
												type="button"
											>
												Add
											</button>
										</div>
									</div>
								))}
							</div>
						</div>
					) : null}

					{/* Reviews */}
					{product && reviews.items.length > 0 ? (
						<div class="store-detail__block">
							<h2 class="store-detail__heading">
								Reviews{" "}
								<span class="store-detail__heading-sub">
									{reviews.avgRating.toFixed(1)} · {reviews.totalCount}{" "}
									{reviews.totalCount === 1 ? "review" : "reviews"}
								</span>
							</h2>
							<div class="store-reviews">
								{reviews.items.map((r) => (
									<div class="bd-card store-review" key={r.id}>
										<div class="store-review__head">
											<Stars rating={r.rating} />
											{r.reviewerName ? (
												<span class="store-review__author">
													{r.reviewerName}
												</span>
											) : null}
										</div>
										{r.title ? (
											<h3 class="store-review__title">{r.title}</h3>
										) : null}
										{r.body || r.content ? (
											<p class="store-review__body">{r.body ?? r.content}</p>
										) : null}
									</div>
								))}
							</div>
						</div>
					) : null}

					{/* Related grid — "you may also like" */}
					{product && related.length > 0 ? (
						<div class="store-detail__block">
							<h2 class="store-detail__heading">You may also like</h2>
							<div class="bd-grid-3">
								{related.map((p) => (
									<Link
										class="bd-card service-card store-card"
										href={`/store/${p.id}`}
										key={p.id}
									>
										<div class="store-card__media">
											{p.coverImageUrl ? (
												<img
													alt={p.name}
													loading="lazy"
													referrerPolicy="no-referrer"
													src={p.coverImageUrl}
												/>
											) : (
												<div class="store-card__placeholder">No image</div>
											)}
										</div>
										<h3>{p.name}</h3>
										{p.minPriceDollars != null ? (
											<span class="service-card__price">
												{formatMoney(Math.round(p.minPriceDollars * 100), "usd")}
											</span>
										) : null}
									</Link>
								))}
							</div>
						</div>
					) : null}
				</section>
			</main>
			<Footer />
		</>
	);
});

export const head: DocumentHead = ({ resolveValue }) => {
	const data = resolveValue(useProduct);
	const name = data.product?.name ?? "Product";
	return {
		title: `${name} — Your Business`,
		meta: [{ name: "description", content: `${name} — buy now.` }],
	};
};

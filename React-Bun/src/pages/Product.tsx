import { useState } from "react";
import { bd, dollars, money } from "../lib/bd";
import { Link } from "../lib/router";
import { ErrorBox, useApi } from "./ui";

/** Five-star glyph row from an average rating (supports half stars). */
function Stars({ rating }: { rating: number }) {
	const full = Math.floor(rating);
	const half = rating - full >= 0.5;
	return (
		<span className="product-card__stars" aria-label={`${rating.toFixed(1)} out of 5`}>
			{[0, 1, 2, 3, 4].map((i) => (
				<span key={i}>{i < full ? "★" : i === full && half ? "⯨" : "☆"}</span>
			))}
		</span>
	);
}

export function Product() {
	const id = decodeURIComponent(window.location.pathname.split("/")[2] ?? "");
	const { data, error, loading } = useApi(() => bd.storefront.getProduct(id), [id]);
	// Companion surfaces — each is independent + graceful (null/empty on failure).
	const { data: reviewsData } = useApi(() => bd.storefront.getProductReviews(id, { limit: 10 }), [id]);
	const { data: relatedData } = useApi(() => bd.storefront.getRelatedProducts(id, { limit: 6 }), [id]);
	const { data: addonsData } = useApi(() => bd.storefront.getProductAddons(id), [id]);
	const [variant, setVariant] = useState("");
	const [status, setStatus] = useState("");
	const [adding, setAdding] = useState(false);

	if (loading)
		return (
			<main className="page">
				<p className="muted">Loading…</p>
			</main>
		);
	if (error || !data)
		return (
			<main className="page">
				<ErrorBox error={error} />
			</main>
		);

	const product = data;
	const images: string[] = Array.isArray(product.images) ? product.images : [];
	const variants: Record<string, any>[] = Array.isArray(product.variants) ? product.variants : [];

	const reviews: Record<string, any>[] = reviewsData?.items ?? [];
	const avgRating: number = reviewsData?.avgRating ?? 0;
	const reviewCount: number = reviewsData?.totalCount ?? 0;
	const related: Record<string, any>[] = relatedData?.items ?? [];
	const addons: Record<string, any>[] = addonsData?.items ?? [];

	const add = async () => {
		setAdding(true);
		setStatus("Adding…");
		try {
			const snap = await bd.cart.add({ productId: id, variantId: variant || null, quantity: 1 });
			setStatus(`Added — cart has ${snap.itemCount ?? "?"} item(s).`);
		} catch (e: any) {
			setStatus(`Couldn't add: ${e?.message ?? e}`);
		} finally {
			setAdding(false);
		}
	};

	const addAddon = async (addonProductId: string) => {
		setAdding(true);
		setStatus("Adding…");
		try {
			const snap = await bd.cart.add({ productId: addonProductId, quantity: 1 });
			setStatus(`Added — cart has ${snap.itemCount ?? "?"} item(s).`);
		} catch (e: any) {
			setStatus(`Couldn't add: ${e?.message ?? e}`);
		} finally {
			setAdding(false);
		}
	};

	return (
		<main className="page">
			<Link className="backlink" to="/store">
				← Back to store
			</Link>
			<div className="product-detail">
				{images[0] ? (
					<img className="product-detail__img" src={images[0]} alt={product.name} />
				) : (
					<div className="product-detail__img product-detail__img--ph" />
				)}
				<div className="product-detail__body">
					<h1 className="product-detail__name">{product.name ?? "Product"}</h1>
					{reviewCount > 0 ? (
						<div className="product-card__rating">
							<Stars rating={avgRating} />
							<span className="muted">
								{avgRating.toFixed(1)} · {reviewCount} review{reviewCount === 1 ? "" : "s"}
							</span>
						</div>
					) : null}
					{product.description ? <p className="product-detail__desc">{product.description}</p> : null}
					{variants.length > 0 ? (
						<select className="product-detail__variant" value={variant} onChange={(e) => setVariant(e.target.value)}>
							<option value="">Choose a variant…</option>
							{variants.map((v) => (
								<option key={v.id ?? v.variantId} value={v.id ?? v.variantId ?? ""}>
									{`${v.title ?? v.name ?? "Variant"}${v.price != null ? ` — ${dollars(v.price, v.currency ?? product.currency)}` : ""}`}
								</option>
							))}
						</select>
					) : null}
					<button className="btn btn--primary" type="button" disabled={adding} onClick={add}>
						Add to cart
					</button>
					<p className="product-detail__status">
						{status}
						{status.startsWith("Added") ? (
							<>
								{" "}
								<Link to="/cart">View cart →</Link>
							</>
						) : null}
					</p>
				</div>
			</div>

			{/* Companion / cross-sell addons — "complete your X". */}
			{addons.length > 0 ? (
				<section>
					<h2 className="section-title">Complete your order</h2>
					<ul className="addon-list">
						{addons.map((a) => (
							<li key={a.id} className="addon-card">
								{a.imageUrl ? (
									<img className="addon-card__img" src={a.imageUrl} alt={a.addonName} loading="lazy" />
								) : (
									<div className="addon-card__img addon-card__img--ph" />
								)}
								<div className="addon-card__body">
									<div className="addon-card__name">{a.addonName}</div>
									{a.groupLabel ? <div className="muted">{a.groupLabel}</div> : null}
									<div className="addon-card__pricing">
										{a.priceCents != null ? (
											<span className="product-card__price">{money(a.priceCents)}</span>
										) : null}
										{a.originalPriceCents != null && a.originalPriceCents !== a.priceCents ? (
											<span className="product-card__compare">{money(a.originalPriceCents)}</span>
										) : null}
									</div>
								</div>
								<button
									className="btn btn--ghost btn--sm"
									type="button"
									disabled={adding}
									onClick={() => addAddon(a.addonProductId)}
								>
									Add
								</button>
							</li>
						))}
					</ul>
				</section>
			) : null}

			{/* "You may also like" recommendations. */}
			{related.length > 0 ? (
				<section>
					<h2 className="section-title">You may also like</h2>
					<div className="product-grid">
						{related.map((r) => (
							<Link
								key={r.id}
								className="product-card"
								to={`/store/${encodeURIComponent(r.id)}`}
							>
								<div className="product-card__media">
									{r.coverImageUrl ? (
										<img className="product-card__img" src={r.coverImageUrl} alt={r.name} loading="lazy" />
									) : (
										<div className="product-card__img product-card__img--ph" />
									)}
								</div>
								<div className="product-card__body">
									<div className="product-card__name">{r.name}</div>
									{r.minPriceDollars != null ? (
										<div className="product-card__price">From {dollars(r.minPriceDollars)}</div>
									) : null}
								</div>
							</Link>
						))}
					</div>
				</section>
			) : null}

			{/* Approved customer reviews. */}
			{reviews.length > 0 ? (
				<section>
					<h2 className="section-title">
						Reviews{reviewCount > 0 ? ` (${reviewCount})` : ""}
					</h2>
					<ul className="review-list">
						{reviews.map((rv) => (
							<li key={rv.id} className="review-card">
								<div className="review-card__head">
									<span className="review-card__name">{rv.reviewerName ?? "Customer"}</span>
									<span className="review-card__stars">
										{"★".repeat(Math.round(rv.rating))}
										{"☆".repeat(5 - Math.round(rv.rating))}
									</span>
								</div>
								{rv.title ? <strong>{rv.title}</strong> : null}
								{rv.body || rv.content ? <p>{rv.body ?? rv.content}</p> : null}
							</li>
						))}
					</ul>
				</section>
			) : null}
		</main>
	);
}

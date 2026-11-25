// [bd-file:store]
"use client";
import type {
	StorefrontAddonsResponse,
	StorefrontProductDetail,
	StorefrontProductReviewsResponse,
	StorefrontRelatedProductsResponse,
} from "@businessdash/sdk/contracts";
import { useEffect, useMemo, useState } from "react";
import { BdLink } from "../bd-link";
import { CompareBar } from "./CompareBar";
import { ProductRail } from "./ProductRail";
import { SaveButtons } from "./SaveButtons";
import { StarRating } from "./StarRating";
import {
	chosenOptions,
	defaultVariant,
	formatCents,
	formatDollars,
	galleryFor,
	optionGroupsFor,
	priceFor,
	recentlyViewed,
	type SavedProduct,
	shareLink,
	toProductView,
} from "./shop";

export type AddToCartInput = {
	productId: string;
	variantId?: string;
	quantity: number;
	/** Chosen options, such as `{ Size: "42" }`; the cart prices them. */
	options?: Record<string, string>;
};
export type AddToCartResult =
	| { ok: true; itemCount: number }
	| { ok: false; error: string };

type Addon = StorefrontAddonsResponse["items"][number];

/**
 * The product page: photos that follow the chosen option, option and size
 * buttons, the price for what's chosen, add to cart, save and compare, share,
 * details, add-ons, reviews with "Show more", related products and what was
 * viewed before. The shop logic is in `./shop`; adding to the cart is the
 * page's `addToCart`, so each framework calls its own server.
 */
export function ProductDetail({
	product,
	reviews,
	addons,
	related,
	moreReviewsHref,
	cartHref,
	addToCart,
	onCartCount,
}: {
	product: StorefrontProductDetail;
	reviews: StorefrontProductReviewsResponse | null;
	addons: Addon[];
	related: StorefrontRelatedProductsResponse["items"];
	/** The link that shows more reviews, or null when all are shown. */
	moreReviewsHref: string | null;
	cartHref: string;
	addToCart: (input: AddToCartInput) => Promise<AddToCartResult>;
	/** Told the cart's new item count after an add, for a cart badge. */
	onCartCount?: (count: number) => void;
}) {
	const view = useMemo(
		() => toProductView(product as Record<string, unknown>),
		[product],
	);
	const [variantId, setVariantId] = useState(
		() => defaultVariant(view)?.id ?? "",
	);
	const [chosen, setChosen] = useState<Record<string, string>>({});
	const [photo, setPhoto] = useState(0);
	const [quantity, setQuantity] = useState(1);
	const [busy, setBusy] = useState(false);
	const [message, setMessage] = useState<{
		kind: "ok" | "error";
		text: string;
	} | null>(null);
	const [shareNote, setShareNote] = useState("");
	const [addingAddon, setAddingAddon] = useState<string | null>(null);
	const [addedAddons, setAddedAddons] = useState<Record<string, boolean>>({});
	const [recent, setRecent] = useState<SavedProduct[]>([]);

	// A new product (following a related link) starts over. Compared by id:
	// the same product can arrive as a new object when the page refreshes
	// after an add to cart, and that must keep the shopper's choices.
	const [shownId, setShownId] = useState(view.id);
	if (shownId !== view.id) {
		setShownId(view.id);
		setVariantId(defaultVariant(view)?.id ?? "");
		setChosen({});
		setPhoto(0);
		setQuantity(1);
		setMessage(null);
	}

	const gallery = galleryFor(view, variantId);
	const groups = optionGroupsFor(view, variantId);
	const price = priceFor(view, variantId, chosen);
	const startDollars = price.amount ?? view.variants[0]?.price ?? null;
	const summary: SavedProduct = {
		id: view.id,
		name: view.name,
		image: view.images[0] ?? null,
		priceCents: startDollars != null ? Math.round(startDollars * 100) : null,
	};

	// Recently viewed: shown before this one is added, so it isn't in its own list.
	useEffect(() => {
		setRecent(recentlyViewed.read().filter((item) => item.id !== view.id));
		recentlyViewed.add(summary);
	}, [view.id]);

	const cta =
		price.amount === null
			? "Sold out"
			: !price.ready
				? "Choose options"
				: busy
					? "Adding…"
					: "Add to cart";

	function pickVariant(next: string) {
		setVariantId(next);
		setChosen({});
		setPhoto(0);
	}

	async function handleAdd() {
		if (!price.ready) return;
		setBusy(true);
		setMessage(null);
		const res = await addToCart({
			productId: view.id,
			variantId: variantId || undefined,
			quantity,
			options: chosenOptions(view, variantId, chosen),
		});
		setBusy(false);
		if (res.ok) {
			onCartCount?.(res.itemCount);
			setMessage({ kind: "ok", text: `Added ${quantity} to your cart.` });
		} else {
			setMessage({ kind: "error", text: res.error });
		}
	}

	async function handleAddAddon(addon: Addon) {
		setAddingAddon(addon.id);
		const first = (
			Array.isArray(addon.variants) ? addon.variants[0] : undefined
		) as { variantId?: unknown; id?: unknown } | undefined;
		const variant = first?.variantId ?? first?.id;
		const res = await addToCart({
			productId: addon.addonProductId,
			variantId: typeof variant === "string" ? variant : undefined,
			quantity: 1,
		});
		setAddingAddon(null);
		if (res.ok) {
			onCartCount?.(res.itemCount);
			setAddedAddons((prev) => ({ ...prev, [addon.id]: true }));
		}
	}

	async function share() {
		const url = `${window.location.origin}${window.location.pathname}`;
		const result = await shareLink(url, view.name);
		const note =
			result === "copied"
				? "Link copied"
				: result === "failed"
					? "Couldn't share"
					: "";
		setShareNote(note);
		if (note) setTimeout(() => setShareNote(""), 2500);
	}

	const relatedCards: SavedProduct[] = related.map((rp) => ({
		id: rp.id,
		name: rp.name,
		image: rp.coverImageUrl,
		priceCents:
			rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
	}));
	const step = (by: number) =>
		setPhoto((p) => (p + by + gallery.length) % gallery.length);

	return (
		<>
			<nav aria-label="Breadcrumb" className="crumbs">
				<BdLink href="/store">Store</BdLink>
				{view.categoryId && (
					<>
						<span aria-hidden="true">/</span>
						<BdLink href={`/store?category=${view.categoryId}`}>
							{view.categoryName ?? "Category"}
						</BdLink>
					</>
				)}
				<span aria-hidden="true">/</span>
				<span aria-current="page">{view.name}</span>
			</nav>

			<div className="product-detail">
				<div className="gallery">
					<div className="gallery__main">
						{gallery[photo] ? (
							<img
								alt={view.name}
								referrerPolicy="no-referrer"
								src={gallery[photo]}
							/>
						) : (
							<div className="gallery__placeholder">No photo yet</div>
						)}
						{gallery.length > 1 && (
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
					{gallery.length > 1 && (
						<div className="gallery__thumbs">
							{gallery.map((src, i) => (
								<button
									aria-current={i === photo}
									aria-label={`Photo ${i + 1} of ${gallery.length}`}
									className={`gallery__thumb${i === photo ? " gallery__thumb--on" : ""}`}
									key={`${src}${i}`}
									onClick={() => setPhoto(i)}
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

				<div className="product-detail__info bd-card">
					<div>
						{view.categoryName && (
							<p className="product-detail__eyebrow">{view.categoryName}</p>
						)}
						<h1>{view.name}</h1>
						{reviews && reviews.totalCount > 0 && (
							<a className="product-detail__rating" href="#reviews">
								<StarRating rating={reviews.avgRating} />
								<span>
									{reviews.avgRating.toFixed(1)} · {reviews.totalCount} reviews
								</span>
							</a>
						)}
					</div>

					<p className="product-detail__price">
						{price.amount != null ? (
							<>
								{price.from && (
									<span className="product-detail__from">From</span>
								)}{" "}
								{formatDollars(price.amount * quantity)}
								{quantity > 1 && (
									<span className="product-detail__each">
										{" "}
										({formatDollars(price.amount)} each)
									</span>
								)}
							</>
						) : (
							"Sold out"
						)}
					</p>

					{view.description && (
						<p className="product-detail__desc">{view.description}</p>
					)}

					{view.variants.length > 1 && (
						<fieldset className="choice">
							<legend className="bd-label">Option</legend>
							<div className="choice__values">
								{view.variants.map((v) => (
									<button
										aria-pressed={v.id === variantId}
										className={`choice__value${v.id === variantId ? " choice__value--on" : ""}`}
										disabled={!v.available}
										key={v.id}
										onClick={() => pickVariant(v.id)}
										type="button"
									>
										{v.name}
										{v.price != null && groups.length === 0 && (
											<small> {formatDollars(v.price)}</small>
										)}
									</button>
								))}
							</div>
						</fieldset>
					)}

					{groups.map((group) => (
						<fieldset className="choice" key={group.id}>
							<legend className="bd-label">
								{group.title}
								{chosen[group.id] && (
									<span className="choice__picked">
										{" "}
										{group.values.find((v) => v.id === chosen[group.id])?.value}
									</span>
								)}
							</legend>
							<div className="choice__values">
								{group.values.map((value) => (
									<button
										aria-pressed={chosen[group.id] === value.id}
										className={`choice__value${chosen[group.id] === value.id ? " choice__value--on" : ""}`}
										disabled={!value.available}
										key={value.id}
										onClick={() =>
											setChosen((prev) => ({ ...prev, [group.id]: value.id }))
										}
										title={value.available ? undefined : "Sold out"}
										type="button"
									>
										{value.value}
									</button>
								))}
							</div>
						</fieldset>
					))}

					{price.stock != null && price.stock > 0 && price.stock <= 5 && (
						<p className="product-detail__stock">Only {price.stock} left</p>
					)}

					<div className="buy">
						{/* biome-ignore lint/a11y/useSemanticElements: one inline stepper; a fieldset would bring its own border and legend layout */}
						<div aria-label="Quantity" className="qty" role="group">
							<button
								aria-label="One fewer"
								disabled={quantity <= 1}
								onClick={() => setQuantity((q) => Math.max(1, q - 1))}
								type="button"
							>
								−
							</button>
							<span aria-live="polite">{quantity}</span>
							<button
								aria-label="One more"
								disabled={price.stock != null && quantity >= price.stock}
								onClick={() => setQuantity((q) => Math.min(999, q + 1))}
								type="button"
							>
								+
							</button>
						</div>
						<button
							className="bd-btn buy__add"
							disabled={busy || !price.ready}
							onClick={handleAdd}
							type="button"
						>
							{cta}
						</button>
					</div>

					{message && (
						<div
							className={`product-detail__msg${message.kind === "error" ? " product-detail__msg--err" : ""}`}
							role="status"
						>
							{message.text}
							{message.kind === "ok" && (
								<BdLink className="bd-btn bd-btn--ghost" href={cartHref}>
									View cart
								</BdLink>
							)}
						</div>
					)}

					<div className="product-detail__tools">
						<SaveButtons product={summary} />
						<button className="share" onClick={share} type="button">
							<span aria-hidden="true">↗</span> Share
						</button>
						{shareNote && (
							<span className="share__note" role="status">
								{shareNote}
							</span>
						)}
					</div>

					<ul className="policies">
						<li>Secure checkout with Stripe</li>
						<li>
							Questions? <BdLink href="/#contact">Ask us</BdLink> before you buy
						</li>
					</ul>
				</div>
			</div>

			{(view.features.length > 0 || view.specs.length > 0) && (
				<section className="product-section" id="specs">
					<h2 className="product-section__title">Details</h2>
					{view.features.length > 0 && (
						<ul className="features">
							{view.features.map((feature) => (
								<li key={feature}>{feature}</li>
							))}
						</ul>
					)}
					{view.specs.map((group) => (
						<table className="specs" key={group.name}>
							<caption>{group.name}</caption>
							<tbody>
								{group.rows.map((row) => (
									<tr key={row.label}>
										<th scope="row">{row.label}</th>
										<td>{row.value}</td>
									</tr>
								))}
							</tbody>
						</table>
					))}
				</section>
			)}

			{addons.length > 0 && (
				<section className="product-section">
					<h2 className="product-section__title">Complete your purchase</h2>
					<div className="addon-grid">
						{addons.map((addon) => (
							<div className="addon-card bd-card" key={addon.id}>
								<div className="addon-card__media">
									{addon.imageUrl ? (
										<img
											alt={addon.addonName}
											loading="lazy"
											referrerPolicy="no-referrer"
											src={addon.imageUrl}
										/>
									) : (
										<div className="addon-card__noimg">—</div>
									)}
								</div>
								<div className="addon-card__body">
									{addon.groupLabel && (
										<span className="addon-card__group">
											{addon.groupLabel}
										</span>
									)}
									<p className="addon-card__name">{addon.addonName}</p>
									{addon.priceCents != null && (
										<span className="addon-card__price">
											{formatCents(addon.priceCents)}
										</span>
									)}
								</div>
								<button
									className="bd-btn bd-btn--ghost addon-card__add"
									disabled={
										addingAddon === addon.id || addedAddons[addon.id] === true
									}
									onClick={() => handleAddAddon(addon)}
									type="button"
								>
									{addedAddons[addon.id]
										? "Added"
										: addingAddon === addon.id
											? "…"
											: "Add"}
								</button>
							</div>
						))}
					</div>
				</section>
			)}

			<section className="product-section" id="reviews">
				<h2 className="product-section__title">Reviews</h2>
				{reviews && reviews.items.length > 0 ? (
					<>
						<p className="reviews__summary">
							<StarRating rating={reviews.avgRating} />
							<strong>{reviews.avgRating.toFixed(1)} out of 5</strong>
							<span>from {reviews.totalCount} reviews</span>
						</p>
						<div className="review-list">
							{reviews.items.map((review) => (
								<article className="review" key={review.id}>
									<div className="review__head">
										<StarRating rating={review.rating} />
										<span className="review__name">
											{review.reviewerName || "Verified buyer"}
										</span>
										<span className="review__date">
											{reviewDate(review.createdAt)}
										</span>
									</div>
									{review.title && (
										<p className="review__title">{review.title}</p>
									)}
									{(review.content || review.body) && (
										<p className="review__body">
											{review.content || review.body}
										</p>
									)}
								</article>
							))}
						</div>
						{moreReviewsHref && (
							<BdLink
								className="bd-btn bd-btn--ghost reviews__more"
								href={moreReviewsHref}
							>
								Show more reviews
							</BdLink>
						)}
					</>
				) : (
					<p className="reviews__none">No reviews yet.</p>
				)}
			</section>

			<ProductRail products={relatedCards} title="You may also like" />
			<ProductRail products={recent} title="Recently viewed" />
			<CompareBar />
		</>
	);
}

function reviewDate(iso: string | null | undefined): string {
	const date = iso ? new Date(iso) : null;
	return date && !Number.isNaN(date.getTime())
		? date.toLocaleDateString(undefined, {
				year: "numeric",
				month: "short",
				day: "numeric",
			})
		: "";
}

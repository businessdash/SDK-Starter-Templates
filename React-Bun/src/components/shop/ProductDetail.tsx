// [bd-file:store]
import type {
	StorefrontProductDetail,
	StorefrontProductReviewsResponse,
	StorefrontRelatedProductsResponse,
} from "@businessdash/sdk/contracts";
import { useEffect, useMemo, useState } from "react";
import { AddToCartButton } from "./AddToCartButton";
import { type CartMessage, CartNotice } from "./CartNotice";
import { CompareBar } from "./CompareBar";
import { OptionPicker } from "./OptionPicker";
import { type Addon, ProductAddons } from "./ProductAddons";
import { ProductBreadcrumbs } from "./ProductBreadcrumbs";
import { ProductGallery } from "./ProductGallery";
import { ProductPolicies } from "./ProductPolicies";
import { ProductPrice } from "./ProductPrice";
import { ProductRail } from "./ProductRail";
import { ProductReviews } from "./ProductReviews";
import { ProductSpecs } from "./ProductSpecs";
import { ProductTitle } from "./ProductTitle";
import { QuantityStepper } from "./QuantityStepper";
import { SaveButtons } from "./SaveButtons";
import { ShareButton } from "./ShareButton";
import { StockNote } from "./StockNote";
import {
	chosenOptions,
	defaultVariant,
	galleryFor,
	optionGroupsFor,
	priceFor,
	type ProductView,
	recentlyViewed,
	type SavedProduct,
	toProductView,
} from "./shop";
import { VariantPicker } from "./VariantPicker";

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

/** The saved-list entry for a product at a price. */
function savedSummary(view: ProductView, dollars: number | null): SavedProduct {
	return {
		id: view.id,
		name: view.name,
		image: view.images[0] ?? null,
		priceCents: dollars != null ? Math.round(dollars * 100) : null,
	};
}

/** The recently viewed products other than this one. */
function recentOtherThan(id: string): SavedProduct[] {
	return recentlyViewed.read().filter((item) => item.id !== id);
}

/**
 * The product page: photos that follow the chosen option, option and size
 * buttons, the price for what's chosen, add to cart, save and compare, share,
 * details, add-ons, reviews with "Show more", related products and what was
 * viewed before. The shop logic is in `./shop`; adding to the cart is the
 * page's `addToCart`, so each framework calls its own server.
 *
 * It's built from the parts imported above, one file each. Use this whole,
 * or lay the parts out your own way on your own product page.
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
	const [message, setMessage] = useState<CartMessage | null>(null);
	const [recent, setRecent] = useState<SavedProduct[]>(() => recentOtherThan(view.id));

	// A new product (following a related link) starts over. Compared by id:
	// the same product can arrive as a new object when the page refreshes
	// after an add to cart, and that must keep the shopper's choices.
	const [shownId, setShownId] = useState(view.id);
	if (shownId !== view.id) {
		setShownId(view.id);
		setRecent(recentOtherThan(view.id));
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
	const summary = savedSummary(view, startDollars);

	// Recently viewed: read before this one is added, so it isn't in its own list.
	useEffect(() => {
		const start = defaultVariant(view)?.id ?? "";
		const dollars = priceFor(view, start, {}).amount ?? view.variants[0]?.price ?? null;
		recentlyViewed.add(savedSummary(view, dollars));
	}, [view]);

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

	const relatedCards: SavedProduct[] = related.map((rp) => ({
		id: rp.id,
		name: rp.name,
		image: rp.coverImageUrl,
		priceCents:
			rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
	}));

	return (
		<>
			<ProductBreadcrumbs product={view} />

			<div className="product-detail">
				<ProductGallery
					index={photo}
					name={view.name}
					onIndexChange={setPhoto}
					photos={gallery}
				/>

				<div className="product-detail__info bd-card">
					<ProductTitle product={view} reviews={reviews} />
					<ProductPrice price={price} quantity={quantity} />
					{view.description && (
						<p className="product-detail__desc">{view.description}</p>
					)}
					<VariantPicker
						onSelect={pickVariant}
						selected={variantId}
						showPrices={groups.length === 0}
						variants={view.variants}
					/>
					{groups.map((group) => (
						<OptionPicker
							group={group}
							key={group.id}
							onSelect={(valueId) =>
								setChosen((prev) => ({ ...prev, [group.id]: valueId }))
							}
							selected={chosen[group.id]}
						/>
					))}
					<StockNote stock={price.stock} />

					<div className="buy">
						<QuantityStepper
							max={price.stock}
							onChange={setQuantity}
							quantity={quantity}
						/>
						<AddToCartButton busy={busy} onAdd={handleAdd} price={price} />
					</div>
					<CartNotice cartHref={cartHref} message={message} />

					<div className="product-detail__tools">
						<SaveButtons product={summary} />
						<ShareButton title={view.name} />
					</div>
					<ProductPolicies />
				</div>
			</div>

			<ProductSpecs features={view.features} specs={view.specs} />
			<ProductAddons
				addons={addons}
				addToCart={addToCart}
				onCartCount={onCartCount}
			/>
			<ProductReviews moreHref={moreReviewsHref} reviews={reviews} />
			<ProductRail products={relatedCards} title="You may also like" />
			<ProductRail products={recent} title="Recently viewed" />
			<CompareBar />
		</>
	);
}

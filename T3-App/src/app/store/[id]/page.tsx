// [bd-file:store]
import type { Metadata } from "next";
import { notFound } from "next/navigation";

import { addItemAction } from "@/app/_actions/store";
import {
	getStoreProduct,
	getStoreProductAddons,
	getStoreProductReviews,
	getStoreRelatedProducts,
	isStoreConfigured,
} from "@/server/lib/bd-store";

import { Notice } from "../_components/Notice";
import { ProductPageClient } from "./ProductPageClient";

export const dynamic = "force-dynamic";

/** Reviews shown at first; "Show more reviews" adds this many each time. */
const REVIEWS_PAGE = 10;

type Props = {
	params: Promise<{ id: string }>;
	searchParams: Promise<{ reviews?: string | string[] }>;
};

export async function generateMetadata({ params }: Props): Promise<Metadata> {
	const { id } = await params;
	const product = isStoreConfigured() ? await getStoreProduct(id) : null;
	return { title: product?.name ?? "Product" };
}

/**
 * One product: the shared `ProductDetail` (photos, options, price, add to
 * cart, save, compare, share, details, add-ons, reviews, related and
 * recently viewed). Reviews grow with ?reviews=N, so "Show more reviews" is
 * a plain link that works without JavaScript.
 */
export default async function ProductPage({ params, searchParams }: Props) {
	const { id } = await params;
	const shownRaw = (await searchParams).reviews;
	const shown = Number.parseInt(
		(Array.isArray(shownRaw) ? shownRaw[0] : shownRaw) ?? "",
		10,
	);
	const reviewLimit = Number.isFinite(shown)
		? Math.min(Math.max(shown, REVIEWS_PAGE), 100)
		: REVIEWS_PAGE;

	if (!isStoreConfigured()) {
		return (
			<Notice
				body="BD env (BD_API_KEY / BD_SITE_ID / base URL) isn't set, so the SDK client can't initialise. See .env.example."
				title="Store isn't connected"
			/>
		);
	}

	const product = await getStoreProduct(id);
	if (!product) notFound();

	const [reviews, addons, related] = await Promise.all([
		getStoreProductReviews(id, { limit: reviewLimit }),
		getStoreProductAddons(id),
		getStoreRelatedProducts(id),
	]);
	const moreReviewsHref =
		reviews && reviews.totalCount > reviews.items.length
			? `/store/${id}?reviews=${reviewLimit + REVIEWS_PAGE}#reviews`
			: null;

	return (
		<ProductPageClient
			addons={addons?.items ?? []}
			addToCart={addItemAction}
			cartHref="/store/cart"
			moreReviewsHref={moreReviewsHref}
			product={product}
			related={related?.items ?? []}
			reviews={reviews}
		/>
	);
}

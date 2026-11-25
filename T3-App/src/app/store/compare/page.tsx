// [bd-file:store]
import type { Metadata } from "next";

import {
	getStoreProduct,
	getStoreProductReviews,
	isStoreConfigured,
} from "@/server/lib/bd-store";

import { CompareClient } from "./CompareClient";

export const dynamic = "force-dynamic";
export const metadata: Metadata = { title: "Compare products" };

/** As many as the compare bar lets a visitor pick. */
const MOST = 4;

/**
 * Products side by side. They come from ?ids=a,b,c, so a comparison can be
 * shared; opened without ids, the page moves this browser's picks into the
 * URL.
 */
export default async function ComparePage({
	searchParams,
}: {
	searchParams: Promise<{ ids?: string | string[] }>;
}) {
	const raw = (await searchParams).ids;
	const ids = [
		...new Set(
			(Array.isArray(raw) ? raw.join(",") : (raw ?? ""))
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean),
		),
	].slice(0, MOST);

	const found = isStoreConfigured()
		? await Promise.all(
				ids.map(async (id) => {
					const [product, reviews] = await Promise.all([
						getStoreProduct(id),
						getStoreProductReviews(id, { limit: 1 }),
					]);
					if (!product) return null;
					return {
						product,
						rating:
							reviews && reviews.totalCount > 0
								? { avg: reviews.avgRating, count: reviews.totalCount }
								: null,
					};
				}),
			)
		: [];
	const columns = found.filter((c) => c !== null);

	return (
		<>
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Shop</span>
				<h1 className="bd-section__title">Compare products</h1>
			</div>
			<CompareClient columns={columns} ids={ids} />
		</>
	);
}

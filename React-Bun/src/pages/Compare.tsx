// [bd-file:store]
import type { StorefrontProductDetail } from "@businessdash/sdk/contracts";

import { StoreNav } from "../components/StoreNav";
import { type CompareColumn, CompareTable } from "../components/shop/CompareTable";
import { bd } from "../lib/bd";
import { useRoute, useSearchParams } from "../lib/route";
import { useApi } from "./use-api";

/** As many as the compare bar lets a visitor pick. */
const MOST = 4;

async function loadColumns(ids: string[]): Promise<CompareColumn[]> {
	const found = await Promise.all(
		ids.map(async (id): Promise<CompareColumn | null> => {
			const [product, reviews] = await Promise.all([
				bd.storefront.getProduct(id).catch(() => null),
				bd.storefront.getProductReviews(id, { limit: 1 }).catch(() => null),
			]);
			if (!product) return null;
			return {
				product: product as StorefrontProductDetail,
				rating:
					reviews && reviews.totalCount > 0 ? { avg: Number(reviews.avgRating), count: Number(reviews.totalCount) } : null,
			};
		}),
	);
	return found.filter((column) => column !== null);
}

/**
 * Products side by side. They come from ?ids=a,b,c, so a comparison can be
 * shared; opened without ids, the page moves this browser's picks into the
 * URL.
 */
export function Compare() {
	const { navigate } = useRoute();
	const params = useSearchParams();
	const ids = [
		...new Set(
			(params.get("ids") ?? "")
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean),
		),
	].slice(0, MOST);
	const key = ids.join(",");
	const { data } = useApi(() => loadColumns(ids), [key]);

	return (
		<>
			<StoreNav />
			<main className="bd-page">
				<div className="bd-section__lead">
					<span className="bd-section__eyebrow">Shop</span>
					<h1 className="bd-section__title">Compare products</h1>
				</div>
				{data === null && ids.length > 0 ? (
					<p className="bd-loading">Loading products…</p>
				) : (
					<CompareTable
						columns={data ?? []}
						ids={ids}
						onIdsChange={(next) =>
							navigate(next.length > 0 ? `/store/compare?ids=${next.join(",")}` : "/store/compare", {
								replace: true,
								scroll: false,
							})
						}
					/>
				)}
			</main>
		</>
	);
}

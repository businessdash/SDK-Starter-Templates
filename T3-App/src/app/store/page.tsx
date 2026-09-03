import {
	isStoreConfigured,
	listStoreCategories,
	listStoreProductsWithMeta,
} from "@/server/lib/bd-store";

import {
	StoreView,
	type StoreViewFilters,
	type StoreViewMeta,
	type StoreViewStatus,
} from "./_components/StoreView";

export const dynamic = "force-dynamic";

type SortValue = NonNullable<StoreViewFilters["sort"]>;
const SORTS: readonly SortValue[] = [
	"featured",
	"newest",
	"price-asc",
	"price-desc",
	"rating-desc",
];

type Search = Record<string, string | string[] | undefined>;
function one(v: string | string[] | undefined): string | undefined {
	return Array.isArray(v) ? v[0] : v;
}

const EMPTY_META: StoreViewMeta = {
	items: [],
	categoryCounts: [],
	priceRange: { minDollars: 0, maxDollars: 0 },
};

export default async function StorePage({
	searchParams,
}: {
	searchParams: Promise<Search>;
}) {
	const sp = await searchParams;
	const search = one(sp.q)?.trim() || undefined;
	const categoryId = one(sp.category) || undefined;
	const sortRaw = one(sp.sort);
	const sort = SORTS.includes(sortRaw as SortValue)
		? (sortRaw as SortValue)
		: "featured";
	const ratingRaw = Number.parseInt(one(sp.rating) ?? "", 10);
	const minRating =
		Number.isFinite(ratingRaw) && ratingRaw >= 1 && ratingRaw <= 5
			? ratingRaw
			: undefined;
	const [minDollarsRaw, maxDollarsRaw] = (one(sp.price) ?? "")
		.split("-")
		.map((n) => Number.parseInt(n, 10));
	const minDollars = Number.isFinite(minDollarsRaw) ? minDollarsRaw : undefined;
	const maxDollars = Number.isFinite(maxDollarsRaw) ? maxDollarsRaw : undefined;

	let status: StoreViewStatus = "ok";
	let meta: StoreViewMeta = EMPTY_META;
	let categories: Array<{ id: string; name: string }> = [];

	if (!isStoreConfigured()) {
		status = "unconfigured";
	} else {
		const [m, cats] = await Promise.all([
			listStoreProductsWithMeta({
				search,
				categoryId,
				minRating,
				minPriceCents: minDollars != null ? minDollars * 100 : undefined,
				maxPriceCents: maxDollars != null ? maxDollars * 100 : undefined,
				sort,
				limit: 50,
			}),
			listStoreCategories(),
		]);
		if (m === null) {
			status = "failed";
		} else {
			meta = m;
			categories = (cats?.items ?? []).map((c) => ({ id: c.id, name: c.name }));
		}
	}

	const filters: StoreViewFilters = {
		search,
		categoryId,
		sort,
		minRating,
		minDollars,
		maxDollars,
	};

	return (
		<StoreView
			categories={categories}
			filters={filters}
			meta={meta}
			status={status}
		/>
	);
}

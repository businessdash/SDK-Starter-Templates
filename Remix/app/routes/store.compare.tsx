// [bd-file:store]
import { useLoaderData, useNavigate } from "react-router";
import type {
	LinksFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import shopStyles from "~/bd-shop.css?url";
import { SiteHeader } from "~/components/SiteHeader";
import { StoreNav } from "~/components/StoreNav";
import { CompareTable } from "~/components/shop/CompareTable";
import {
	getCartSnapshot,
	getStoreProduct,
	getStoreProductReviews,
} from "~/lib/bd-store.server";

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: shopStyles },
];

export const meta: MetaFunction = () => [{ title: "Compare products — Store" }];

/** As many as the compare bar lets a visitor pick. */
const MOST = 4;

/**
 * Products side by side. They come from ?ids=a,b,c, so a comparison can be
 * shared; opened without ids, the page moves this browser's picks into the
 * URL.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const ids = [
		...new Set(
			(new URL(request.url).searchParams.get("ids") ?? "")
				.split(",")
				.map((id) => id.trim())
				.filter(Boolean),
		),
	].slice(0, MOST);
	const [found, cart] = await Promise.all([
		Promise.all(
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
		),
		getCartSnapshot(request),
	]);
	return {
		ids,
		columns: found.filter((c) => c !== null),
		cartCount: cart?.itemCount ?? 0,
	};
}

export default function ComparePage() {
	const { ids, columns, cartCount } = useLoaderData<typeof loader>();
	const navigate = useNavigate();
	return (
		<>
			<SiteHeader />
			<StoreNav cartCount={cartCount} />
			<main className="bd-page">
				<div className="bd-section__lead">
					<span className="bd-section__eyebrow">Shop</span>
					<h1 className="bd-section__title">Compare products</h1>
				</div>
				<CompareTable
					columns={columns}
					ids={ids}
					onIdsChange={(next) =>
						navigate(
							next.length > 0
								? `/store/compare?ids=${next.join(",")}`
								: "/store/compare",
							{ replace: true, preventScrollReset: true },
						)
					}
				/>
			</main>
		</>
	);
}

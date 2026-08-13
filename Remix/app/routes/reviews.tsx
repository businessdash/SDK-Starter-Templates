import { useEffect, useState } from "react";
import { useFetcher, useLoaderData } from "react-router";
import type { LoaderFunctionArgs, MetaFunction } from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import {
	getMarketingBundle,
	getReviewsFromBundle,
} from "~/lib/biab-bundle.server";
import { isServiceSuspended } from "~/lib/biab.server";

export const meta: MetaFunction = () => [{ title: "Reviews — Your Business" }];

type WallReview = {
	id: string;
	reviewerName: string;
	text: string;
	rating: number;
	timeCreated: string;
};

export async function loader(_: LoaderFunctionArgs) {
	try {
		const bundle = await getMarketingBundle();
		const reviews = getReviewsFromBundle(bundle);
		if (!reviews) {
			return { suspended: false, average: null, count: 0, first: [] as WallReview[] };
		}
		// Bundle review items use `{ reviewee, description, date, rating }`. Map
		// them into the same WALL shape `/api/reviews` returns so "load more"
		// appends seamlessly.
		const first: WallReview[] = reviews.items.map((r, i) => ({
			id: `bundle-${i}`,
			reviewerName: r.reviewee,
			text: r.description,
			rating: r.rating,
			timeCreated: r.date,
		}));
		return {
			suspended: false,
			average: reviews.rating,
			count: reviews.totalCount ?? first.length,
			first,
		};
	} catch (err) {
		if (isServiceSuspended(err)) {
			return { suspended: true, average: null, count: 0, first: [] as WallReview[] };
		}
		throw err;
	}
}

export default function ReviewsPage() {
	const { suspended, average, count, first } = useLoaderData<typeof loader>();
	const fetcher = useFetcher<{
		items: WallReview[];
		totalCount: number;
		nextOffset: number | null;
	}>();
	const [items, setItems] = useState<WallReview[]>(first);
	const [nextOffset, setNextOffset] = useState<number | null>(
		first.length > 0 ? first.length : null,
	);

	useEffect(() => {
		if (fetcher.data) {
			setItems((prev) => [...prev, ...fetcher.data!.items]);
			setNextOffset(fetcher.data.nextOffset);
		}
	}, [fetcher.data]);

	function loadMore() {
		if (nextOffset == null) return;
		fetcher.load(`/api/reviews?offset=${nextOffset}&limit=10`);
	}

	if (suspended) {
		return (
			<>
				<SiteHeader />
				<main>
					<section className="section">
						<h1 className="section__title">Reviews</h1>
						<p className="muted">Temporarily unavailable. Please check back soon.</p>
					</section>
				</main>
			</>
		);
	}

	return (
		<>
			<SiteHeader />
			<main>
				<section className="section">
					<h1 className="section__title">Reviews</h1>
					{average != null ? (
						<p className="reviews-agg">
							<strong>{average.toFixed(1)}</strong> ★ · {count} review
							{count === 1 ? "" : "s"}
						</p>
					) : (
						<p className="muted">No reviews yet.</p>
					)}
					<ul className="review-list">
						{items.map((r) => (
							<li className="review" key={r.id}>
								<div className="review__head">
									<strong>{r.reviewerName}</strong>
									<span className="stars">{"★".repeat(Math.round(r.rating))}</span>
								</div>
								<p>{r.text}</p>
							</li>
						))}
					</ul>
					{nextOffset != null && items.length < count ? (
						<button
							className="biab-btn"
							onClick={loadMore}
							disabled={fetcher.state !== "idle"}
						>
							{fetcher.state !== "idle" ? "Loading…" : "Load more"}
						</button>
					) : null}
				</section>
			</main>
		</>
	);
}

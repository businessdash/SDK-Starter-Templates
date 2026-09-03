import type { BundleReviews } from "@/server/lib/bd";

import { ReviewsLoadMore } from "./ReviewsLoadMore";

/**
 * Reviews wall. The aggregate (average + total count) and the first page of
 * bodies ride the marketing bundle; the "Load more" button pages deeper via
 * the `bd.reviewsPage` tRPC procedure. Renders an empty-state note when the
 * org has no reviews yet (or BD is unconfigured).
 */

function formatDate(iso: string): string {
	const d = new Date(iso);
	return Number.isNaN(d.getTime())
		? ""
		: d.toLocaleDateString(undefined, { year: "numeric", month: "short" });
}

function Stars({ rating }: { rating: number }) {
	const full = Math.round(rating);
	return (
		<span aria-label={`${rating} out of 5`} className="review-stars" role="img">
			{"★".repeat(full)}
			{"☆".repeat(Math.max(0, 5 - full))}
		</span>
	);
}

export function Reviews({ reviews }: { reviews: BundleReviews | null }) {
	const items = reviews?.items ?? [];
	const total = reviews?.totalCount ?? items.length;
	const average = reviews?.rating ?? null;

	return (
		<section className="bd-section" id="reviews">
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Reviews</span>
				<h2 className="bd-section__title">What customers say</h2>
				{average != null ? (
					<p className="bd-section__sub">
						<span className="review-aggregate">
							<Stars rating={average} /> {average.toFixed(1)}
						</span>{" "}
						from {total} review{total === 1 ? "" : "s"}
					</p>
				) : (
					<p className="bd-section__sub">
						Reviews from Google, Yelp and more — synced through BD.
					</p>
				)}
			</div>

			{items.length === 0 ? (
				<div className="bd-empty">
					No reviews yet. Connect your Google/Yelp profile in BD and
					they&apos;ll appear here.
				</div>
			) : (
				<>
					<div className="bd-grid-3">
						{items.map((r) => (
							<article className="bd-card review-card" key={r.id}>
								<Stars rating={r.rating} />
								<p className="review-card__body">{r.description}</p>
								<footer className="review-card__meta">
									<span>{r.reviewee}</span>
									<span>
										{r.platform} · {formatDate(r.date)}
									</span>
								</footer>
							</article>
						))}
					</div>
					<ReviewsLoadMore
						initialNextOffset={items.length < total ? items.length : null}
						shownCount={items.length}
						totalCount={total}
					/>
				</>
			)}
		</section>
	);
}

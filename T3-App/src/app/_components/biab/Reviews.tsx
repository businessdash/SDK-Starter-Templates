import type { BundleReviews } from "@/server/lib/biab";

import { ReviewsLoadMore } from "./ReviewsLoadMore";

/**
 * Reviews wall. The aggregate (average + total count) and the first page of
 * bodies ride the marketing bundle; the "Load more" button pages deeper via
 * the `biab.reviewsPage` tRPC procedure. Renders an empty-state note when the
 * org has no reviews yet (or BIAB is unconfigured).
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
		<section className="biab-section" id="reviews">
			<div className="biab-section__lead">
				<span className="biab-section__eyebrow">Reviews</span>
				<h2 className="biab-section__title">What customers say</h2>
				{average != null ? (
					<p className="biab-section__sub">
						<span className="review-aggregate">
							<Stars rating={average} /> {average.toFixed(1)}
						</span>{" "}
						from {total} review{total === 1 ? "" : "s"}
					</p>
				) : (
					<p className="biab-section__sub">
						Reviews from Google, Yelp and more — synced through BIAB.
					</p>
				)}
			</div>

			{items.length === 0 ? (
				<div className="biab-empty">
					No reviews yet. Connect your Google/Yelp profile in BIAB and
					they&apos;ll appear here.
				</div>
			) : (
				<>
					<div className="biab-grid-3">
						{items.map((r) => (
							<article className="biab-card review-card" key={r.id}>
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

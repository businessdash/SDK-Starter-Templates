import type { BundleReviews } from "@/server/lib/bd";

import {
	formatReviewDate,
	platformName,
	reviewStars,
	safeImage,
} from "./reviews/reviews";

/**
 * The home page's reviews: the rating and a few of the newest, from the
 * marketing bundle, and a link to every review on /reviews. Renders an
 * empty-state note when the org has no reviews yet (or BD is unconfigured).
 */
const SHOWN_HERE = 3;

export function Reviews({ reviews }: { reviews: BundleReviews | null }) {
	const items = (reviews?.items ?? []).slice(0, SHOWN_HERE);
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
							<span
								aria-label={`${average.toFixed(1)} out of 5`}
								className="review-stars"
								role="img"
							>
								{reviewStars(average)}
							</span>{" "}
							{average.toFixed(1)}
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
					<ul className="bd-grid-3 review-wall">
						{items.map((r) => {
							const avatar = safeImage(r.image);
							const platform = platformName(r.platform);
							return (
								<li className="review-card" key={r.id}>
									<div className="review-card__head">
										{avatar ? (
											<img
												alt=""
												className="review-card__avatar"
												loading="lazy"
												src={avatar}
											/>
										) : (
											<span aria-hidden="true" className="review-card__avatar">
												{(r.reviewee.trim() || "A").charAt(0).toUpperCase()}
											</span>
										)}
										<div>
											<p className="review-card__name">
												{r.reviewee.trim() || "Anonymous"}
											</p>
											<p className="review-card__meta">
												<span
													aria-label={`${r.rating} out of 5`}
													className="review-stars"
													role="img"
												>
													{reviewStars(r.rating)}
												</span>{" "}
												· {formatReviewDate(r.date)}
											</p>
										</div>
									</div>
									<p className="review-card__text">{r.description}</p>
									{platform ? (
										<p className="review-card__foot">
											<span className="review-card__platform">{platform}</span>
										</p>
									) : null}
								</li>
							);
						})}
					</ul>
					<p className="reviews-more">
						<a className="bd-btn bd-btn--ghost" href="/reviews">
							See all {total} reviews
						</a>
					</p>
				</>
			)}
		</section>
	);
}

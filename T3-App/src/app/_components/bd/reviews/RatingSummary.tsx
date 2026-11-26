import type { ReactNode } from "react";
import { reviewStars } from "./reviews";
import type { ReviewsPageData } from "./reviews-page";

/**
 * The business's rating: the average, its stars, how many reviews, and a
 * bar per star. `writer` sits beside it (the review form, or sign in).
 */
export function RatingSummary({
	summary,
	writer,
}: {
	summary: ReviewsPageData["summary"];
	writer: ReactNode;
}) {
	const average = summary.average?.toFixed(1) ?? null;
	return (
		<section
			aria-label={average ? "Rating" : "Write a review"}
			className="reviews-summary"
		>
			{average ? (
				<>
					<div className="reviews-summary__score">
						<span className="reviews-summary__average">{average}</span>
						<span
							aria-label={`${average} out of 5`}
							className="review-stars"
							role="img"
						>
							{reviewStars(summary.average ?? 0)}
						</span>
						<span className="reviews-summary__count">
							{summary.total} {summary.total === 1 ? "review" : "reviews"}
						</span>
					</div>
					<ul className="reviews-bars">
						{summary.histogram.map((row) => (
							<li
								aria-label={`${row.stars} ${row.stars === 1 ? "star" : "stars"}: ${row.count}`}
								key={row.stars}
							>
								<span>{row.stars} ★</span>
								<span className="reviews-bars__track">
									<span
										className="reviews-bars__fill"
										style={{ width: `${Math.round(row.share * 100)}%` }}
									/>
								</span>
								<span>{row.count}</span>
							</li>
						))}
					</ul>
				</>
			) : null}
			<div className="reviews-summary__write">{writer}</div>
		</section>
	);
}

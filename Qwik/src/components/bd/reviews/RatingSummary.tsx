import { elementHtml } from "../../../lib/bd-elements";
import { reviewStars } from "../../../lib/shop/reviews";

/**
 * The average with its stars and the number of reviews, a bar per star, and
 * "Write a review" (`<bd-review-writer>`, src/lib/shop/reviews-elements.ts,
 * written as HTML so Qwik leaves what it draws alone). Before there are any
 * reviews, just the writer.
 */
export function RatingSummary({
	summary,
	signedIn,
}: {
	summary: { average: number | null; total: number; histogram: Array<{ stars: number; count: number; share: number }> };
	signedIn: boolean;
}) {
	const average = summary.average?.toFixed(1) ?? null;
	return (
		<section class="reviews-summary" aria-label={average ? "Rating" : "Write a review"}>
			{average ? (
				<>
					<div class="reviews-summary__score">
						<span class="reviews-summary__average">{average}</span>
						<span class="review-stars" role="img" aria-label={`${average} out of 5`}>
							{reviewStars(summary.average ?? 0)}
						</span>
						<span class="reviews-summary__count">
							{summary.total} {summary.total === 1 ? "review" : "reviews"}
						</span>
					</div>
					<ul class="reviews-bars">
						{summary.histogram.map((row) => (
							<li key={row.stars} aria-label={`${row.stars} stars: ${row.count}`}>
								<span>{row.stars} ★</span>
								<span class="reviews-bars__track">
									<span class="reviews-bars__fill" style={{ width: `${Math.round(row.share * 100)}%` }} />
								</span>
								<span>{row.count}</span>
							</li>
						))}
					</ul>
				</>
			) : null}
			<div
				class="reviews-summary__write"
				dangerouslySetInnerHTML={elementHtml(
					"bd-review-writer",
					{ "data-write-url": "/api/bd/reviews/write", "data-sign-in-href": "/my-account?next=%2Freviews" },
					{ signedIn },
				)}
			/>
		</section>
	);
}

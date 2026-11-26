import { For, Show } from "solid-js";

import { elementHtml } from "../../../lib/bd-elements";
import { reviewStars } from "../../../lib/shop/reviews";

/**
 * The average, the stars and how many reviews, a bar per star, and "Write
 * a review" (`<bd-review-writer>`, src/lib/shop/reviews-elements.ts, which
 * posts to /api/bd/reviews/write; signed out, it's a link to sign in).
 */
export function RatingSummary(props: {
	summary: {
		average: number | null;
		total: number;
		histogram: Array<{ stars: number; count: number; share: number }>;
	};
	signedIn: boolean;
}) {
	const average = () => props.summary.average?.toFixed(1) ?? null;
	return (
		<section
			class="reviews-summary"
			aria-label={average() ? "Rating" : "Write a review"}
		>
			<Show when={average()}>
				<div class="reviews-summary__score">
					<span class="reviews-summary__average">{average()}</span>
					<span
						class="review-stars"
						role="img"
						aria-label={`${average()} out of 5`}
					>
						{reviewStars(props.summary.average ?? 0)}
					</span>
					<span class="reviews-summary__count">
						{props.summary.total}{" "}
						{props.summary.total === 1 ? "review" : "reviews"}
					</span>
				</div>
				<ul class="reviews-bars">
					<For each={props.summary.histogram}>
						{(row) => (
							<li
								aria-label={`${row.stars} ${row.stars === 1 ? "star" : "stars"}: ${row.count}`}
							>
								<span>{row.stars} ★</span>
								<span class="reviews-bars__track">
									<span
										class="reviews-bars__fill"
										style={{ width: `${Math.round(row.share * 100)}%` }}
									/>
								</span>
								<span>{row.count}</span>
							</li>
						)}
					</For>
				</ul>
			</Show>
			<div
				class="reviews-summary__write"
				innerHTML={elementHtml(
					"bd-review-writer",
					{
						"data-write-url": "/api/bd/reviews/write",
						"data-sign-in-href": "/my-account?next=%2Freviews",
					},
					{ signedIn: props.signedIn },
				)}
			/>
		</section>
	);
}

import { ChangeDetectionStrategy, Component, CUSTOM_ELEMENTS_SCHEMA, computed, input } from "@angular/core";
import { type ReviewSummary, reviewStars } from "../../shop/reviews";

/**
 * The business's rating: the average, its stars, how many reviews, a bar
 * per star, and writing a review. `<bd-review-writer>`
 * (src/app/shop/reviews-elements.ts, which the reviews page loads) posts a
 * written review to `writeUrl`; signed out, it's a link to sign in.
 */
@Component({
	selector: "bd-rating-summary",
	changeDetection: ChangeDetectionStrategy.OnPush,
	schemas: [CUSTOM_ELEMENTS_SCHEMA],
	styles: ":host { display: contents; }",
	template: `
		<section class="reviews-summary" [attr.aria-label]="average() ? 'Rating' : 'Write a review'">
			@if (average(); as average) {
				<div class="reviews-summary__score">
					<span class="reviews-summary__average">{{ average }}</span>
					<span class="review-stars" role="img" [attr.aria-label]="average + ' out of 5'">{{ stars() }}</span>
					<span class="reviews-summary__count">{{ totalLabel() }}</span>
				</div>
				<ul class="reviews-bars">
					@for (bar of bars(); track bar.stars) {
						<li [attr.aria-label]="bar.stars + (bar.stars === 1 ? ' star: ' : ' stars: ') + bar.count">
							<span>{{ bar.stars }} ★</span>
							<span class="reviews-bars__track"
								><span class="reviews-bars__fill" [style.width.%]="bar.width"></span
							></span>
							<span>{{ bar.count }}</span>
						</li>
					}
				</ul>
			}
			<div class="reviews-summary__write">
				<bd-review-writer
					[attr.data-sign-in-href]="signInHref()"
					[attr.data-write-url]="writeUrl()"
					[data]="writer()"
				></bd-review-writer>
			</div>
		</section>
	`,
})
export class RatingSummaryComponent {
	readonly summary = input.required<ReviewSummary>();
	readonly signedIn = input.required<boolean>();
	readonly writeUrl = input("/api/bd/reviews/write");
	readonly signInHref = input("/my-account?next=%2Freviews");

	readonly average = computed(() => this.summary().average?.toFixed(1) ?? null);
	readonly stars = computed(() => reviewStars(this.summary().average ?? 0));
	readonly totalLabel = computed(() => {
		const total = this.summary().total;
		return `${total} ${total === 1 ? "review" : "reviews"}`;
	});
	readonly bars = computed(() =>
		this.summary().histogram.map((row) => ({ ...row, width: Math.round(row.share * 100) })),
	);
	readonly writer = computed(() => ({ signedIn: this.signedIn() }));
}

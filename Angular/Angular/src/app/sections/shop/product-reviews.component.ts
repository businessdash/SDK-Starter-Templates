// [bd-file:store]
import { ChangeDetectionStrategy, Component, input } from "@angular/core";
import type { StorefrontProductReviewsResponse } from "@businessdash/sdk/contracts";
import { reviewDate } from "../../shop/shop";
import { StarRatingComponent } from "../star-rating.component";

/** The product's reviews: the average, each review, and Show more reviews. */
@Component({
	selector: "bd-product-reviews",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [StarRatingComponent],
	styles: ":host { display: contents; }",
	template: `
		<section class="product-section" id="reviews">
			<h2 class="product-section__title">Reviews</h2>
			@if (reviews(); as r) {
				@if (r.items.length > 0) {
					<p class="reviews__summary">
						<bd-star-rating [rating]="r.avgRating" />
						<strong>{{ r.avgRating.toFixed(1) }} out of 5</strong>
						<span>from {{ r.totalCount }} reviews</span>
					</p>
					<div class="review-list">
						@for (review of r.items; track review.id) {
							<article class="review">
								<div class="review__head">
									<bd-star-rating [rating]="review.rating" />
									<span class="review__name">{{ review.reviewerName || "Verified buyer" }}</span>
									<span class="review__date">{{ date(review.createdAt) }}</span>
								</div>
								@if (review.title) {
									<p class="review__title">{{ review.title }}</p>
								}
								@if (review.content || review.body) {
									<p class="review__body">{{ review.content || review.body }}</p>
								}
							</article>
						}
					</div>
					@if (moreHref(); as more) {
						<a class="bd-btn bd-btn--ghost reviews__more" [href]="more">Show more reviews</a>
					}
				} @else {
					<p class="reviews__none">No reviews yet.</p>
				}
			} @else {
				<p class="reviews__none">No reviews yet.</p>
			}
		</section>
	`,
})
export class ProductReviewsComponent {
	readonly reviews = input.required<StorefrontProductReviewsResponse | null>();
	readonly moreHref = input<string | null>(null);
	readonly date = reviewDate;
}

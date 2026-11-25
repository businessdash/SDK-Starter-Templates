import { ChangeDetectionStrategy, Component, computed, input } from "@angular/core";
import {
	formatReviewDate,
	platformName,
	reviewerInitial,
	reviewerName,
	reviewLink,
	reviewStars,
	safeImage,
	type WallReview,
} from "../../shop/reviews";

/**
 * One review: the reviewer's photo (or initial) and name, stars and date,
 * the text, their photos, the platform, Verified, and a link to it on
 * Google or Yelp. Use it on the list item: `<li bd-review-card [review]="…">`.
 */
@Component({
	selector: "li[bd-review-card]",
	changeDetection: ChangeDetectionStrategy.OnPush,
	host: { class: "review-card" },
	template: `
		@let r = review();
		<div class="review-card__head">
			@if (avatar(); as avatar) {
				<img alt="" class="review-card__avatar" loading="lazy" [src]="avatar" />
			} @else {
				<span aria-hidden="true" class="review-card__avatar">{{ initial() }}</span>
			}
			<div>
				<p class="review-card__name">{{ name() }}</p>
				<p class="review-card__meta">
					<span class="review-stars" role="img" [attr.aria-label]="r.rating + ' out of 5'">{{ stars() }}</span>
					· {{ date() }}
				</p>
			</div>
		</div>
		<p class="review-card__text">{{ r.text }}</p>
		@if (photos().length > 0) {
			<ul aria-label="Photos from the reviewer" class="review-card__photos">
				@for (photo of photos(); track photo) {
					<li><img alt="" loading="lazy" [src]="photo" /></li>
				}
			</ul>
		}
		@if (platform() || r.verified) {
			<p class="review-card__foot">
				@if (platform(); as platform) {
					<span class="review-card__platform">{{ platform }}</span>
				}
				@if (r.verified) {
					<span class="review-card__verified">✓ Verified</span>
				}
				@if (link() && platform()) {
					<a class="review-card__link" rel="noopener noreferrer" target="_blank" [href]="link()"
						>Read on {{ platform() }}</a
					>
				}
			</p>
		}
	`,
})
export class ReviewCardComponent {
	readonly review = input.required<WallReview>();

	readonly avatar = computed(() => safeImage(this.review().reviewerImageUrl));
	readonly initial = computed(() => reviewerInitial(this.review()));
	readonly name = computed(() => reviewerName(this.review()));
	readonly stars = computed(() => reviewStars(this.review().rating));
	readonly date = computed(() => formatReviewDate(this.review().timeCreated));
	readonly photos = computed(() =>
		(this.review().photos ?? []).map(safeImage).filter((p): p is string => p !== null),
	);
	readonly platform = computed(() => platformName(this.review().source));
	readonly link = computed(() => reviewLink(this.review()));
}

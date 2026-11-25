import { html, type Raw } from "../../html";
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
 * One review, as a list item: the reviewer's photo (or initial) and name,
 * stars and date, the text, their photos, the platform, Verified, and a
 * link to it on Google or Yelp.
 */
export function reviewCard(r: WallReview): Raw {
	const avatar = safeImage(r.reviewerImageUrl);
	const platform = platformName(r.source);
	const link = reviewLink(r);
	const photos = (r.photos ?? []).map(safeImage).filter((p): p is string => p !== null);
	return html`<li class="review-card">
		<div class="review-card__head">
			${avatar ? html`<img class="review-card__avatar" src="${avatar}" alt="" loading="lazy" />` : html`<span class="review-card__avatar" aria-hidden="true">${reviewerInitial(r)}</span>`}
			<div>
				<p class="review-card__name">${reviewerName(r)}</p>
				<p class="review-card__meta"><span class="review-stars" role="img" aria-label="${`${r.rating} out of 5`}">${reviewStars(r.rating)}</span> · ${formatReviewDate(r.timeCreated)}</p>
			</div>
		</div>
		<p class="review-card__text">${r.text}</p>
		${
			photos.length
				? html`<ul class="review-card__photos" aria-label="Photos from the reviewer">${photos.map((p) => html`<li><img src="${p}" alt="" loading="lazy" /></li>`)}</ul>`
				: ""
		}
		${
			platform || r.verified
				? html`<p class="review-card__foot">
			${platform ? html`<span class="review-card__platform">${platform}</span>` : ""}
			${r.verified ? html`<span class="review-card__verified">✓ Verified</span>` : ""}
			${link && platform ? html`<a class="review-card__link" href="${link}" target="_blank" rel="noopener noreferrer">Read on ${platform}</a>` : ""}
		</p>`
				: ""
		}
	</li>`;
}

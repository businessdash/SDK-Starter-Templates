// [bd-file:store]
import { html, type Raw } from "../../html";

/** Stars for a rating, the same markup the shop's elements draw. */
export function starRating(rating: number): Raw {
	return html`<span aria-label="${`${rating.toFixed(1)} out of 5`}" class="stars" role="img">${[1, 2, 3, 4, 5].map((i) => {
		const on = rating >= i;
		const half = !on && rating >= i - 0.5;
		return html`<span class="stars__star${on ? " stars__star--on" : ""}${half ? " stars__star--half" : ""}">★</span>`;
	})}</span>`;
}

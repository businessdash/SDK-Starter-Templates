// [bd-file:store]
import { component$ } from "@builder.io/qwik";

/** Stars for a rating, in the markup the shop's styles and elements use. */
export const ShopStars = component$<{ rating: number }>(({ rating }) => {
	return (
		<span aria-label={`${rating.toFixed(1)} out of 5`} class="stars" role="img">
			{[1, 2, 3, 4, 5].map((step) => {
				const on = rating >= step;
				const half = !on && rating >= step - 0.5;
				return (
					<span
						class={`stars__star${on ? " stars__star--on" : ""}${half ? " stars__star--half" : ""}`}
						key={step}
					>
						★
					</span>
				);
			})}
		</span>
	);
});

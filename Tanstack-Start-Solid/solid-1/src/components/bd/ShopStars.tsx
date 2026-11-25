// [bd-file:store]
import { For } from "solid-js";

/** Stars for a rating, in the markup the shop's styles and elements use. */
export function ShopStars(props: { rating: number }) {
	return (
		<span
			aria-label={`${props.rating.toFixed(1)} out of 5`}
			class="stars"
			role="img"
		>
			<For each={[1, 2, 3, 4, 5]}>
				{(step) => (
					<span
						class={`stars__star${props.rating >= step ? " stars__star--on" : ""}${
							props.rating < step && props.rating >= step - 0.5
								? " stars__star--half"
								: ""
						}`}
					>
						★
					</span>
				)}
			</For>
		</span>
	);
}

import { For } from "solid-js";

/** A 0–5 star rating, reusing the `.bd-stars` tokens from styles.css.
 *  Renders ★ for filled, ⯨ for half, ☆ for empty — matches the form rating
 *  widget's colors so the storefront and the contact form stay consistent. */
export function Stars(props: { rating: number }) {
	return (
		<span
			aria-label={`${props.rating.toFixed(1)} out of 5`}
			class="bd-stars"
			role="img"
		>
			<For each={[0, 1, 2, 3, 4]}>
				{(i) => {
					const filled = () => props.rating >= i + 1;
					const half = () => !filled() && props.rating >= i + 0.5;
					return (
						<span
							class="bd-stars__star"
							classList={{ "bd-stars__star--on": filled() || half() }}
							style="font-size: 0.95rem; cursor: default;"
						>
							{filled() ? "★" : half() ? "⯨" : "☆"}
						</span>
					);
				}}
			</For>
		</span>
	);
}

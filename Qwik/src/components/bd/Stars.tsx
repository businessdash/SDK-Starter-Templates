import { component$ } from "@builder.io/qwik";

/**
 * A 5-star rating display (full / half / empty), rendered with inline SVGs so
 * the template stays dependency-free. Used by the store listing cards, the
 * sidebar rating filter, and the product detail reviews block.
 */
export const Stars = component$<{ rating: number }>(({ rating }) => {
	return (
		<span
			aria-label={`${rating.toFixed(1)} out of 5`}
			class="bd-stars"
			role="img"
		>
			{[0, 1, 2, 3, 4].map((i) => {
				const filled = rating >= i + 1;
				const half = !filled && rating >= i + 0.5;
				const id = `star-${i}-${half ? "h" : filled ? "f" : "e"}`;
				return (
					<svg
						aria-hidden="true"
						height="14"
						key={i}
						viewBox="0 0 20 20"
						width="14"
					>
						{half ? (
							<defs>
								<linearGradient id={id}>
									<stop offset="50%" stop-color="currentColor" />
									<stop offset="50%" stop-color="transparent" />
								</linearGradient>
							</defs>
						) : null}
						<path
							d="M10 1.5l2.6 5.27 5.82.85-4.21 4.1.99 5.78L10 14.77l-5.2 2.73.99-5.78-4.21-4.1 5.82-.85L10 1.5z"
							fill={half ? `url(#${id})` : filled ? "currentColor" : "none"}
							stroke="currentColor"
							stroke-width="1"
						/>
					</svg>
				);
			})}
		</span>
	);
});

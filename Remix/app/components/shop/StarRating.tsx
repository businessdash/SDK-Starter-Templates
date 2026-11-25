// [bd-file:store]
/** Five stars, filled to `rating` (halves shown). */
export function StarRating({ rating }: { rating: number }) {
	return (
		<span
			aria-label={`${rating.toFixed(1)} out of 5`}
			className="stars"
			role="img"
		>
			{[1, 2, 3, 4, 5].map((i) => {
				const on = rating >= i;
				const half = !on && rating >= i - 0.5;
				return (
					<span
						className={`stars__star${on ? " stars__star--on" : ""}${half ? " stars__star--half" : ""}`}
						key={i}
					>
						★
					</span>
				);
			})}
		</span>
	);
}

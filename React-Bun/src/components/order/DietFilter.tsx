// [bd-file:ordering]
import type { DietFilter as Diet } from "@businessdash/sdk/restaurant";

const OPTIONS: { value: Diet; label: string }[] = [
	{ value: "all", label: "Everything" },
	{ value: "vegetarian", label: "Vegetarian" },
	{ value: "vegan", label: "Vegan" },
];

/** Everything / Vegetarian / Vegan. Vegan dishes count as vegetarian too. */
export function DietFilter({ value, onChange }: { value: Diet; onChange: (diet: Diet) => void }) {
	return (
		<div className="order-seg" role="radiogroup" aria-label="Diet">
			{OPTIONS.map((o) => (
				<button
					key={o.value}
					type="button"
					role="radio"
					aria-checked={value === o.value}
					className={`order-seg__opt${value === o.value ? " order-seg__opt--on" : ""}`}
					onClick={() => onChange(o.value)}
				>
					{o.label}
				</button>
			))}
		</div>
	);
}

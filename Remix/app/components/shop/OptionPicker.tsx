// [bd-file:store]
import type { OptionGroup } from "./shop";

/** One option group, such as Size: a button per value, sold-out ones disabled. */
export function OptionPicker({
	group,
	selected,
	onSelect,
}: {
	group: OptionGroup;
	/** The chosen value's id, if one is chosen. */
	selected: string | undefined;
	onSelect: (valueId: string) => void;
}) {
	return (
		<fieldset className="choice">
			<legend className="bd-label">
				{group.title}
				{selected && (
					<span className="choice__picked">
						{" "}
						{group.values.find((v) => v.id === selected)?.value}
					</span>
				)}
			</legend>
			<div className="choice__values">
				{group.values.map((value) => (
					<button
						aria-pressed={selected === value.id}
						className={`choice__value${selected === value.id ? " choice__value--on" : ""}`}
						disabled={!value.available}
						key={value.id}
						onClick={() => onSelect(value.id)}
						title={value.available ? undefined : "Sold out"}
						type="button"
					>
						{value.value}
					</button>
				))}
			</div>
		</fieldset>
	);
}

// [bd-file:ordering]
import type { RestaurantChoiceGroup } from "@businessdash/sdk/contracts";
import type { ItemPick } from "@businessdash/sdk/restaurant";
import { useEffect, useRef } from "react";
import { createPortal } from "react-dom";
import { money } from "../../lib/bd";
import { DietMark } from "./DietMark";
import { QtyStepper } from "./QtyStepper";

function groupHint(group: RestaurantChoiceGroup): string {
	const { minSelect: min, maxSelect: max } = group;
	if (max === 1) return min >= 1 ? "Pick one" : "Optional · pick one";
	if (min === 0) return max == null ? "Optional" : `Optional · up to ${max}`;
	if (max == null) return `Pick at least ${min}`;
	return min === max ? `Pick ${min}` : `Pick ${min}–${max}`;
}

function extra(cents: number): string {
	return cents > 0 ? `+${money(cents)}` : "";
}

/**
 * The sheet a dish opens: its sizes, each question it asks ("Crust", "Up to
 * 2 toppings"), how many, and the button that puts it on the tray. Nothing
 * is refused silently: pressing Add with something missing lists what is.
 */
export function ChoiceSheet({
	pick,
	canOrder,
	onVariant,
	onToggle,
	onQuantity,
	onConfirm,
	onClose,
}: {
	pick: ItemPick;
	canOrder: boolean;
	onVariant: (variantId: string) => void;
	onToggle: (groupId: string, optionId: string) => void;
	onQuantity: (quantity: number) => void;
	onConfirm: () => void;
	onClose: () => void;
}) {
	const { item } = pick;
	const panel = useRef<HTMLDivElement>(null);

	useEffect(() => {
		panel.current?.focus();
		const onKey = (e: KeyboardEvent) => {
			if (e.key === "Escape") onClose();
		};
		document.addEventListener("keydown", onKey);
		const overflow = document.body.style.overflow;
		document.body.style.overflow = "hidden";
		return () => {
			document.removeEventListener("keydown", onKey);
			document.body.style.overflow = overflow;
		};
	}, [onClose]);

	// On <body>, so no stacking context on the page (a sticky header, a
	// transformed wrapper) can draw over it.
	return createPortal(
		<div className="order-sheet" onClick={(e) => e.target === e.currentTarget && onClose()}>
			<div
				className="order-sheet__panel"
				role="dialog"
				aria-modal="true"
				aria-labelledby="order-sheet-title"
				tabIndex={-1}
				ref={panel}
			>
				{item.imageUrl ? <img className="order-sheet__img" src={item.imageUrl} alt="" /> : null}
				<button type="button" className="order-sheet__close" onClick={onClose} aria-label="Close">
					×
				</button>
				<div className="order-sheet__body">
					<h2 id="order-sheet-title" className="order-sheet__title">
						<DietMark flags={item.dietaryFlags} />
						{item.name}
					</h2>
					{item.description ? <p className="order-sheet__desc">{item.description}</p> : null}
					{item.allergens.length > 0 ? (
						<p className="order-sheet__allergens">Contains {item.allergens.join(", ")}</p>
					) : null}

					{item.variants.length > 1 ? (
						<fieldset className="order-group">
							<legend className="order-group__label">
								Size <span className="order-group__hint">Pick one</span>
							</legend>
							{item.variants.map((v) => (
								<label key={v.id} className="order-opt">
									<input
										type="radio"
										name="order-size"
										checked={pick.variantId === v.id}
										onChange={() => onVariant(v.id)}
									/>
									<span className="order-opt__name">{v.name}</span>
									<span className="order-opt__price">{money(v.priceCents)}</span>
								</label>
							))}
						</fieldset>
					) : null}

					{item.choiceGroups.map((group) => {
						const chosen = pick.choices[group.id] ?? [];
						const full = group.maxSelect != null && group.maxSelect > 1 && chosen.length >= group.maxSelect;
						const single = group.maxSelect === 1;
						return (
							<fieldset key={group.id} className="order-group">
								<legend className="order-group__label">
									{group.label} <span className="order-group__hint">{groupHint(group)}</span>
								</legend>
								{group.options.map((o) => {
									const on = chosen.includes(o.id);
									return (
										<label key={o.id} className={`order-opt${!on && full ? " order-opt--off" : ""}`}>
											<input
												type={single ? "radio" : "checkbox"}
												name={`order-group-${group.id}`}
												checked={on}
												disabled={!on && full}
												onChange={() => onToggle(group.id, o.id)}
												onClick={() => single && on && onToggle(group.id, o.id)}
											/>
											<span className="order-opt__name">{o.name}</span>
											<span className="order-opt__price">{extra(o.priceCents)}</span>
										</label>
									);
								})}
							</fieldset>
						);
					})}

				</div>

				{canOrder ? (
					<div className="order-sheet__foot">
						{/* By the button, so what's missing is in view when Add is pressed. */}
						{pick.showProblems && pick.problems.length > 0 ? (
							<ul className="order-sheet__problems" role="alert">
								{pick.problems.map((p) => (
									<li key={p}>{p}</li>
								))}
							</ul>
						) : null}
						<QtyStepper value={pick.quantity} min={1} onChange={onQuantity} label={item.name} />
						<button type="button" className="bd-btn order-sheet__add" onClick={onConfirm}>
							Add {pick.quantity > 1 ? `${pick.quantity} ` : ""}to order · {money(pick.unitPriceCents * pick.quantity)}
						</button>
					</div>
				) : null}
			</div>
		</div>,
		document.body,
	);
}

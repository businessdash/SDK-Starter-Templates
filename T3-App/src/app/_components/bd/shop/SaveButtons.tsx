// [bd-file:store]
"use client";
import type { MouseEvent } from "react";
import { compareList, type SavedProduct, wishlist } from "./shop";
import { useSavedList } from "./use-saved-list";

/**
 * Save a product to the wishlist, or add it to the compare table. Both lists
 * live in this browser (see `./shop`), so the buttons learn their state once
 * the page is in the browser.
 */
export function SaveButtons({
	product,
	compact = false,
}: {
	product: SavedProduct;
	compact?: boolean;
}) {
	const saved = useSavedList(wishlist).items.some(
		(item) => item.id === product.id,
	);
	const picked = useSavedList(compareList).items;
	const comparing = picked.some((item) => item.id === product.id);
	const compareFull = !comparing && picked.length >= compareList.limit;

	// Inside a product card (a link), pressing a button must not follow it.
	function press(event: MouseEvent, action: () => void) {
		event.preventDefault();
		event.stopPropagation();
		action();
	}

	return (
		<div className={`save-buttons${compact ? " save-buttons--compact" : ""}`}>
			<button
				aria-label={
					saved
						? `Remove ${product.name} from your wishlist`
						: `Save ${product.name} to your wishlist`
				}
				aria-pressed={saved}
				className={`save-buttons__btn${saved ? " save-buttons__btn--on" : ""}`}
				onClick={(e) => press(e, () => wishlist.toggle(product))}
				type="button"
			>
				<span aria-hidden="true">{saved ? "♥" : "♡"}</span>
				{!compact && (saved ? "Saved" : "Save")}
			</button>
			<button
				aria-label={
					comparing
						? `Remove ${product.name} from compare`
						: `Compare ${product.name}`
				}
				aria-pressed={comparing}
				className={`save-buttons__btn${comparing ? " save-buttons__btn--on" : ""}`}
				disabled={compareFull}
				onClick={(e) => press(e, () => compareList.toggle(product))}
				title={
					compareFull
						? `The compare table holds ${compareList.limit}`
						: undefined
				}
				type="button"
			>
				<span aria-hidden="true">⇄</span>
				{!compact && (comparing ? "Comparing" : "Compare")}
			</button>
		</div>
	);
}

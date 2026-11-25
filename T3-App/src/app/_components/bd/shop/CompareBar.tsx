// [bd-file:store]
"use client";
import { BdLink } from "../bd-link";
import { compareList } from "./shop";
import { useSavedList } from "./use-saved-list";

/**
 * Pinned to the bottom of the store while products are picked for the
 * compare table: what's picked, and the way to the table.
 */
export function CompareBar() {
	const { items } = useSavedList(compareList);
	if (items.length === 0) return null;
	return (
		<aside aria-label="Products to compare" className="compare-bar">
			<ul className="compare-bar__items">
				{items.map((item) => (
					<li key={item.id}>
						{item.image && (
							<img alt="" referrerPolicy="no-referrer" src={item.image} />
						)}
						<span>{item.name}</span>
						<button
							aria-label={`Remove ${item.name} from compare`}
							onClick={() => compareList.remove(item.id)}
							type="button"
						>
							×
						</button>
					</li>
				))}
			</ul>
			<div className="compare-bar__actions">
				<button
					className="bd-btn bd-btn--ghost"
					onClick={() => compareList.clear()}
					type="button"
				>
					Clear
				</button>
				<BdLink
					aria-disabled={items.length < 2}
					className="bd-btn"
					href={`/store/compare?ids=${items.map((i) => i.id).join(",")}`}
				>
					{items.length < 2
						? "Pick one more to compare"
						: `Compare ${items.length}`}
				</BdLink>
			</div>
		</aside>
	);
}

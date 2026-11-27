// [bd-file:ordering]
import type { RestaurantMenu } from "@businessdash/sdk/contracts";

/**
 * "All" and one tab per menu category, each with how many dishes it holds.
 * Counts are of the whole menu, so they don't jump while the guest types.
 */
export function CategoryTabs({
	menu,
	selected,
	onSelect,
}: {
	menu: RestaurantMenu;
	selected: string | null;
	onSelect: (categoryId: string | null) => void;
}) {
	const counts = new Map<string, number>();
	for (const item of menu.items) {
		if (item.categoryId) counts.set(item.categoryId, (counts.get(item.categoryId) ?? 0) + 1);
	}
	const tabs = [
		{ id: null, name: "All", count: menu.items.length },
		...menu.categories.map((c) => ({ id: c.id, name: c.name, count: counts.get(c.id) ?? 0 })),
	];
	return (
		<div className="order-cats" role="tablist" aria-label="Menu sections">
			{tabs.map((tab) => (
				<button
					key={tab.id ?? "all"}
					type="button"
					role="tab"
					aria-selected={selected === tab.id}
					className={`order-cat${selected === tab.id ? " order-cat--on" : ""}`}
					onClick={() => onSelect(tab.id)}
				>
					<span className="order-cat__name">{tab.name}</span>
					<span className="order-cat__count">
						{tab.count} {tab.count === 1 ? "item" : "items"}
					</span>
				</button>
			))}
		</div>
	);
}

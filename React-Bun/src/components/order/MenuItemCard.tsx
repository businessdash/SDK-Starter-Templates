// [bd-file:ordering]
import type { RestaurantMenuItem } from "@businessdash/sdk/contracts";
import { needsChoices } from "@businessdash/sdk/restaurant";
import { money } from "../../lib/bd";
import { DietMark } from "./DietMark";

/**
 * One dish: photo, name, what's in it, price and an add button. A dish that
 * asks something (a size, a sauce) opens the choice sheet; one that doesn't
 * goes straight on the tray.
 */
export function MenuItemCard({
	item,
	inTray,
	canOrder,
	onAdd,
	onOpen,
}: {
	item: RestaurantMenuItem;
	/** How many of it are on the tray already, in any size. */
	inTray: number;
	/** False when browsing: the card shows the dish but offers no button. */
	canOrder: boolean;
	onAdd: () => void;
	onOpen: () => void;
}) {
	const asks = needsChoices(item);
	const from = item.variants.length > 1;
	return (
		<article className="order-item">
			<button type="button" className="order-item__media" onClick={onOpen} aria-label={`About ${item.name}`}>
				{item.imageUrl ? (
					<img src={item.imageUrl} alt="" loading="lazy" />
				) : (
					<span className="order-item__initial" aria-hidden="true">
						{item.name.slice(0, 1)}
					</span>
				)}
				{inTray > 0 ? <span className="order-item__badge">{inTray} on tray</span> : null}
			</button>
			<div className="order-item__body">
				<h3 className="order-item__name">
					<DietMark flags={item.dietaryFlags} />
					<button type="button" onClick={onOpen}>
						{item.name}
					</button>
				</h3>
				{item.description ? <p className="order-item__desc">{item.description}</p> : null}
				<div className="order-item__foot">
					<span className="order-item__price">
						{from ? <span className="order-item__from">from </span> : null}
						{money(item.priceCents)}
					</span>
					{canOrder ? (
						<button
							type="button"
							className="order-item__add"
							onClick={onAdd}
							aria-label={asks ? `Choose options for ${item.name}` : `Add ${item.name}`}
						>
							{asks ? "Choose" : "Add"}
						</button>
					) : null}
				</div>
			</div>
		</article>
	);
}

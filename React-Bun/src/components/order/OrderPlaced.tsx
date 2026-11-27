// [bd-file:ordering]
import type { RestaurantPlacedTableOrder } from "@businessdash/sdk/contracts";
import { money } from "../../lib/bd";

/** "It's with the kitchen": what was sent, and the table's running total. */
export function OrderPlaced({
	placed,
	onOrderMore,
}: {
	placed: RestaurantPlacedTableOrder;
	onOrderMore: () => void;
}) {
	return (
		<section className="order-placed" aria-live="polite">
			<span className="order-placed__tick" aria-hidden="true">
				✓
			</span>
			<h2 className="order-placed__title">It's with the kitchen</h2>
			<p className="order-placed__sub">
				Table {placed.tableLabel} · order {placed.orderNumber}
			</p>
			<ul className="order-placed__lines">
				{placed.lines.map((line, i) => (
					<li key={`${line.productName}-${i}`}>
						<span>
							{line.quantity} × {line.productName}
							{line.variantName ? <small>{line.variantName}</small> : null}
						</span>
						<span>{money(line.totalCents)}</span>
					</li>
				))}
			</ul>
			<dl className="order-placed__sum">
				<div>
					<dt>This round</dt>
					<dd>{money(placed.addedCents)}</dd>
				</div>
				<div>
					<dt>Table so far</dt>
					<dd>{money(placed.tabTotalCents)}</dd>
				</div>
			</dl>
			<button type="button" className="bd-btn" onClick={onOrderMore}>
				Order something else
			</button>
		</section>
	);
}

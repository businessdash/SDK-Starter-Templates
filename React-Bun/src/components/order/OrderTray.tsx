// [bd-file:ordering]
import type { TrayLine } from "@businessdash/sdk/restaurant";
import { money } from "../../lib/bd";
import { QtyStepper } from "./QtyStepper";

/**
 * The guest's order so far and the button that sends it. One round at a
 * time: what is sent goes to the kitchen and onto the table's tab, and the
 * tray empties for the next round.
 */
export function OrderTray({
	tableLabel,
	lines,
	itemCount,
	subtotalCents,
	guestName,
	closedReason,
	submitError,
	submitting,
	onQuantity,
	onGuestName,
	onSubmit,
	onClear,
}: {
	tableLabel: string | null;
	lines: readonly TrayLine[];
	itemCount: number;
	subtotalCents: number;
	guestName: string;
	closedReason: string | null;
	submitError: string | null;
	submitting: boolean;
	onQuantity: (key: string, quantity: number) => void;
	onGuestName: (name: string) => void;
	onSubmit: () => void;
	onClear: () => void;
}) {
	const empty = lines.length === 0;
	return (
		<aside className="order-tray" id="order-tray" aria-label="Your order">
			<header className="order-tray__head">
				<h2 className="order-tray__title">Your order</h2>
				{tableLabel ? <span className="order-tray__table">Table {tableLabel}</span> : null}
			</header>

			{empty ? (
				<p className="order-tray__empty">
					{closedReason ?? "Nothing yet. Tap Add on a dish and it lands here."}
				</p>
			) : (
				<ul className="order-tray__lines">
					{lines.map((line) => (
						<li key={line.key} className={`order-line${line.problem ? " order-line--problem" : ""}`}>
							<div className="order-line__main">
								<span className="order-line__name">{line.name}</span>
								{line.detail ? <span className="order-line__detail">{line.detail}</span> : null}
								{line.problem ? <span className="order-line__problem">{line.problem}</span> : null}
							</div>
							<QtyStepper value={line.quantity} onChange={(q) => onQuantity(line.key, q)} label={line.name} />
							<span className="order-line__total">{money(line.totalCents)}</span>
						</li>
					))}
				</ul>
			)}

			{empty ? null : (
				<>
					<label className="order-tray__name">
						<span>Name for the order (optional)</span>
						<input
							type="text"
							value={guestName}
							maxLength={120}
							autoComplete="given-name"
							placeholder="So the server knows who's who"
							onChange={(e) => onGuestName(e.target.value)}
						/>
					</label>
					<div className="order-tray__sum">
						<span>
							{itemCount} {itemCount === 1 ? "item" : "items"}
						</span>
						<strong>{money(subtotalCents)}</strong>
					</div>
					{submitError ? (
						<p className="order-tray__error" role="alert">
							{submitError}
						</p>
					) : closedReason ? (
						<p className="order-tray__note">{closedReason}</p>
					) : null}
					<button
						type="button"
						className="bd-btn order-tray__send"
						onClick={onSubmit}
						disabled={submitting || closedReason !== null}
					>
						{submitting ? "Sending…" : "Send to the kitchen"}
					</button>
					<p className="order-tray__fine">
						Goes on your table's tab. Prices before any tax or service; you settle up with your server at the end.
					</p>
					<button type="button" className="order-tray__clear" onClick={onClear} disabled={submitting}>
						Clear the tray
					</button>
				</>
			)}
		</aside>
	);
}

// [bd-file:ordering]
import { useTableOrder } from "@businessdash/sdk/react";
import { CategoryTabs } from "../components/order/CategoryTabs";
import { ChoiceSheet } from "../components/order/ChoiceSheet";
import { DietFilter } from "../components/order/DietFilter";
import { MenuItemCard } from "../components/order/MenuItemCard";
import { OrderPlaced } from "../components/order/OrderPlaced";
import { OrderTray } from "../components/order/OrderTray";
import { bd, money } from "../lib/bd";
import { useSearchParams } from "../lib/route";
import { ErrorBox } from "./ui";

/**
 * Order from the table. Each table's QR code (BusinessDash → Store → Floor
 * plan → a table → Table QR code) opens /order?table=<token>; what the guest
 * sends goes to the kitchen board and onto that table's tab, and they settle
 * up with their server at the end.
 *
 * Without ?table= it is the menu: everything browses, nothing orders.
 *
 * The behaviour (filters, the choice sheet's rules, the tray, sending) is
 * the SDK's `useTableOrder`; this page and components/order/* are only how
 * it looks, so restyle or rearrange them freely.
 */
export function Order() {
	const params = useSearchParams();
	const order = useTableOrder({ client: bd, tableToken: params.get("table") });
	const canOrder = order.mode === "table" && order.closedReason === null;

	const onTray = new Map<string, number>();
	for (const line of order.lines) onTray.set(line.productId, (onTray.get(line.productId) ?? 0) + line.quantity);

	const table = order.table;
	const title = table ? `Table ${table.tableLabel}` : "Menu";
	const sub = canOrder
		? "Order from your phone. It goes straight to the kitchen."
		: (order.closedReason ?? "");

	return (
		<main className="bd-page order-page">
			<header className="order-head">
				<div>
					<span className="order-head__eyebrow">{table ? table.areaName : "Order"}</span>
					<h1 className="order-head__title">{title}</h1>
					{sub ? <p className="order-head__sub">{sub}</p> : null}
				</div>
				<input
					type="search"
					className="order-search"
					placeholder="Search the menu"
					aria-label="Search the menu"
					value={order.search}
					onChange={(e) => order.setSearch(e.target.value)}
				/>
			</header>

			{order.status === "error" ? <ErrorBox error={order.error} /> : null}
			{order.status === "loading" || order.status === "idle" ? (
				<p className="order-loading">Loading the menu…</p>
			) : null}

			{order.menu ? (
				<div className={`order-layout${order.mode === "table" ? "" : " order-layout--browse"}`}>
					<section className="order-menu" aria-label="Menu">
						<CategoryTabs menu={order.menu} selected={order.categoryId} onSelect={order.selectCategory} />
						<DietFilter value={order.diet} onChange={order.setDiet} />
						{order.items.length === 0 ? (
							<p className="order-none">
								{order.menu.items.length === 0 ? "The menu is empty right now." : "Nothing matches."}{" "}
								{order.menu.items.length > 0 ? (
									<button
										type="button"
										className="order-link"
										onClick={() => {
											order.setSearch("");
											order.setDiet("all");
											order.selectCategory(null);
										}}
									>
										Show the whole menu
									</button>
								) : null}
							</p>
						) : (
							<div className="order-grid">
								{order.items.map((item) => (
									<MenuItemCard
										key={item.id}
										item={item}
										inTray={onTray.get(item.id) ?? 0}
										canOrder={canOrder}
										onAdd={() => order.addItem(item.id)}
										onOpen={() => order.openItem(item.id)}
									/>
								))}
							</div>
						)}
					</section>

					{order.mode === "table" ? (
						order.placed ? (
							<OrderPlaced placed={order.placed} onOrderMore={order.orderMore} />
						) : (
							<OrderTray
								tableLabel={table?.tableLabel ?? null}
								lines={order.lines}
								itemCount={order.itemCount}
								subtotalCents={order.subtotalCents}
								guestName={order.guestName}
								closedReason={order.closedReason}
								submitError={order.submitError}
								submitting={order.submitting}
								onQuantity={order.setQuantity}
								onGuestName={order.setGuestName}
								onSubmit={() => void order.submit()}
								onClear={order.clearTray}
							/>
						)
					) : null}
				</div>
			) : null}

			{order.itemCount > 0 && !order.placed ? (
				<a className="order-bar" href="#order-tray">
					<span>
						View order · {order.itemCount} {order.itemCount === 1 ? "item" : "items"}
					</span>
					<strong>{money(order.subtotalCents)}</strong>
				</a>
			) : null}

			{order.pick ? (
				<ChoiceSheet
					pick={order.pick}
					canOrder={canOrder}
					onVariant={order.chooseVariant}
					onToggle={order.toggleOption}
					onQuantity={order.setPickQuantity}
					onConfirm={order.confirmPick}
					onClose={order.closeItem}
				/>
			) : null}
		</main>
	);
}

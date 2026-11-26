// [bd-file:store]
import type { StorefrontProductDetail } from "@businessdash/sdk/contracts";
import { useEffect, useMemo } from "react";
import { BdLink } from "../bd-link";
import {
	compareList,
	defaultVariant,
	formatDollars,
	toProductView,
} from "./shop";

export type CompareColumn = {
	product: StorefrontProductDetail;
	rating: { avg: number; count: number } | null;
};

/**
 * Up to four products side by side: price, rating, category, options and
 * every spec any of them lists. The products come from the URL (?ids=a,b),
 * so a comparison can be shared; opened without ids, the picks saved in this
 * browser are moved into the URL through `onIdsChange`.
 */
export function CompareTable({
	ids,
	columns,
	onIdsChange,
}: {
	ids: string[];
	columns: CompareColumn[];
	onIdsChange: (ids: string[]) => void;
}) {
	// Only on arrival: later changes come from this table itself.
	useEffect(() => {
		if (ids.length > 0) return;
		const saved = compareList.read().map((item) => item.id);
		if (saved.length > 0) onIdsChange(saved);
		// eslint-disable-next-line react-hooks/exhaustive-deps
	}, []);

	const views = useMemo(
		() =>
			columns.map((column) => ({
				view: toProductView(column.product as Record<string, unknown>),
				rating: column.rating,
			})),
		[columns],
	);

	const specRows = useMemo(() => {
		const rows: { group: string; label: string }[] = [];
		const seen = new Set<string>();
		for (const { view } of views) {
			for (const group of view.specs) {
				for (const row of group.rows) {
					const key = `${group.name}\u0000${row.label}`;
					if (!seen.has(key)) {
						seen.add(key);
						rows.push({ group: group.name, label: row.label });
					}
				}
			}
		}
		return rows;
	}, [views]);

	function remove(id: string) {
		compareList.remove(id);
		onIdsChange(ids.filter((other) => other !== id));
	}

	if (views.length === 0) {
		return (
			<div className="bd-empty">
				Nothing to compare yet. Press <span aria-hidden="true">⇄</span> Compare
				on two or more products.
				<p>
					<BdLink className="bd-btn" href="/store">
						Browse products
					</BdLink>
				</p>
			</div>
		);
	}

	return (
		<div className="compare-scroll">
			<table className="compare">
				<caption className="visually-hidden">Products compared</caption>
				<thead>
					<tr>
						<td />
						{views.map(({ view }) => (
							<th key={view.id} scope="col">
								<BdLink className="compare__product" href={`/store/${view.id}`}>
									{view.images[0] && (
										<img
											alt=""
											referrerPolicy="no-referrer"
											src={view.images[0]}
										/>
									)}
									<span>{view.name}</span>
								</BdLink>
								<button
									className="compare__remove"
									onClick={() => remove(view.id)}
									type="button"
								>
									Remove
								</button>
							</th>
						))}
					</tr>
				</thead>
				<tbody>
					<tr>
						<th scope="row">Price</th>
						{views.map(({ view }) => {
							const variant = defaultVariant(view);
							return (
								<td key={view.id}>
									{variant?.price != null ? formatDollars(variant.price) : "—"}
								</td>
							);
						})}
					</tr>
					<tr>
						<th scope="row">Rating</th>
						{views.map(({ view, rating }) => (
							<td key={view.id}>
								{rating
									? `${rating.avg.toFixed(1)} ★ (${rating.count})`
									: "No reviews"}
							</td>
						))}
					</tr>
					<tr>
						<th scope="row">Category</th>
						{views.map(({ view }) => (
							<td key={view.id}>{view.categoryName ?? "—"}</td>
						))}
					</tr>
					<tr>
						<th scope="row">Options</th>
						{views.map(({ view }) => (
							<td key={view.id}>
								{view.variants.map((v) => v.name).join(", ") || "—"}
							</td>
						))}
					</tr>
					{specRows.map((row) => (
						<tr key={`${row.group}\u0000${row.label}`}>
							<th scope="row">
								{row.label} <small>{row.group}</small>
							</th>
							{views.map(({ view }) => (
								<td key={view.id}>
									{view.specs
										.find((g) => g.name === row.group)
										?.rows.find((r) => r.label === row.label)?.value ?? "—"}
								</td>
							))}
						</tr>
					))}
					<tr>
						<td />
						{views.map(({ view }) => (
							<td key={view.id}>
								<BdLink className="bd-btn" href={`/store/${view.id}`}>
									View product
								</BdLink>
							</td>
						))}
					</tr>
				</tbody>
			</table>
		</div>
	);
}

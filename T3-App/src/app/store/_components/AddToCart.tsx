"use client";

import Link from "next/link";
import { useState, useTransition } from "react";

import { addToCartAction } from "@/app/_actions/store";

import { inStock, type StoreVariant, usd } from "./store-utils";

/** Variant picker + quantity + "add to cart" — calls the `addToCartAction`
 *  Server Action (which mints the visitor-token cookie on first use). */
export function AddToCart({
	productId,
	variants,
}: {
	productId: string;
	variants: StoreVariant[];
}) {
	const [selectedId, setSelectedId] = useState(variants[0]?.id ?? "");
	const [qty, setQty] = useState(1);
	const [pending, startTransition] = useTransition();
	const [result, setResult] = useState<
		{ ok: true; count: number } | { ok: false; error: string } | null
	>(null);

	const selected = variants.find((v) => v.id === selectedId) ?? variants[0];
	if (!selected) return null;
	const available = inStock(selected);

	function handleAdd() {
		if (!selected) return;
		const variantId = selected.id;
		setResult(null);
		startTransition(async () => {
			const res = await addToCartAction({
				productId,
				variantId,
				quantity: qty,
			});
			setResult(
				res.ok
					? { ok: true, count: res.snapshot.itemCount }
					: { ok: false, error: res.error },
			);
		});
	}

	return (
		<div className="store-buy">
			<div className="store-buy__price">
				<span className="store-buy__amount">{usd(selected.price)}</span>
				{selected.compareAtPrice && selected.compareAtPrice > selected.price ? (
					<span className="store-buy__compare">
						{usd(selected.compareAtPrice)}
					</span>
				) : null}
				{!available ? (
					<span className="store-buy__oos">Out of stock</span>
				) : null}
			</div>

			{variants.length > 1 ? (
				<div>
					<label className="biab-label" htmlFor="variant">
						Variant
					</label>
					<select
						className="biab-select"
						id="variant"
						onChange={(e) => setSelectedId(e.target.value)}
						value={selectedId}
					>
						{variants.map((v) => (
							<option key={v.id} value={v.id}>
								{v.name} — {usd(v.price)}
							</option>
						))}
					</select>
				</div>
			) : null}

			<div className="store-buy__qty">
				<label className="biab-label" htmlFor="qty">
					Qty
				</label>
				<input
					className="biab-input"
					id="qty"
					min={1}
					onChange={(e) => setQty(Math.max(1, Number(e.target.value) || 1))}
					type="number"
					value={qty}
				/>
			</div>

			<button
				className="biab-btn"
				disabled={pending || !available}
				onClick={handleAdd}
				type="button"
			>
				{pending ? "Adding…" : "Add to cart"}
			</button>

			{result?.ok ? (
				<p className="store-buy__ok">
					Added. Cart has {result.count} item{result.count === 1 ? "" : "s"} —{" "}
					<Link href="/store/cart">view cart</Link>
				</p>
			) : null}
			{result && !result.ok ? (
				<p className="store-buy__err">addItem failed: {result.error}</p>
			) : null}
		</div>
	);
}

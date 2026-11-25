// [bd-file:store]
"use client";
import { BdLink } from "../bd-link";
import { formatCents, wishlist } from "./shop";
import { useSavedList } from "./use-saved-list";

/** The wishlist: products saved on this device, to open and buy later. */
export function WishlistView() {
	const { items, ready } = useSavedList(wishlist);
	if (!ready) return <p className="bd-loading">Loading…</p>;
	if (items.length === 0) {
		return (
			<div className="bd-empty">
				Nothing saved yet. Press <span aria-hidden="true">♡</span> Save on any
				product.
				<p>
					<BdLink className="bd-btn" href="/store">
						Browse products
					</BdLink>
				</p>
			</div>
		);
	}
	return (
		<>
			<ul className="wishlist bd-grid-4">
				{items.map((item) => (
					<li className="bd-card wishlist__card" key={item.id}>
						<BdLink className="wishlist__link" href={`/store/${item.id}`}>
							{item.image ? (
								<img
									alt=""
									loading="lazy"
									referrerPolicy="no-referrer"
									src={item.image}
								/>
							) : (
								<span aria-hidden="true" className="wishlist__noimg" />
							)}
							<span className="wishlist__name">{item.name}</span>
							{item.priceCents != null && (
								<span className="wishlist__price">
									{formatCents(item.priceCents)}
								</span>
							)}
						</BdLink>
						<button
							className="bd-btn bd-btn--ghost"
							onClick={() => wishlist.remove(item.id)}
							type="button"
						>
							Remove
						</button>
					</li>
				))}
			</ul>
			<p className="wishlist__clear">
				<button
					className="bd-btn bd-btn--ghost"
					onClick={() => wishlist.clear()}
					type="button"
				>
					Clear the wishlist
				</button>
			</p>
		</>
	);
}

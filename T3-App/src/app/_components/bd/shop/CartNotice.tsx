// [bd-file:store]
import { BdLink } from "../bd-link";

export type CartMessage = { kind: "ok" | "error"; text: string };

/** What happened when adding to the cart, with "View cart" after a success. */
export function CartNotice({
	message,
	cartHref,
}: {
	message: CartMessage | null;
	cartHref: string;
}) {
	if (!message) return null;
	return (
		<div
			className={`product-detail__msg${message.kind === "error" ? " product-detail__msg--err" : ""}`}
			role="status"
		>
			{message.text}
			{message.kind === "ok" && (
				<BdLink className="bd-btn bd-btn--ghost" href={cartHref}>
					View cart
				</BdLink>
			)}
		</div>
	);
}

// [bd-file:store]
import { createFileRoute } from "@tanstack/solid-router";

import { getBd } from "../../../../lib/bd";
import { cartVisitorToken } from "../../../../lib/bd-server-fns";

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * Add to the cart for `<bd-product>`: JSON `{ productId, variantId?,
 * quantity?, options? }` in; `{ ok, itemCount }` or `{ ok: false, error }`
 * out. The first add mints the visitor's cart cookie.
 */
export const Route = createFileRoute("/api/bd/cart/add")({
	server: {
		handlers: {
			POST: async ({ request }) => {
				const bd = getBd();
				if (!bd)
					return json(503, {
						ok: false,
						error: "The store isn't connected yet.",
					});
				// A JSON body only: a form on another site can't send one.
				if (
					!request.headers.get("content-type")?.includes("application/json")
				) {
					return json(415, { ok: false, error: "Send JSON." });
				}
				const body = (await request.json().catch(() => null)) as {
					productId?: unknown;
					variantId?: unknown;
					quantity?: unknown;
					options?: unknown;
				} | null;
				const productId =
					typeof body?.productId === "string" ? body.productId : "";
				if (!productId)
					return json(400, { ok: false, error: "Choose a product." });
				const quantity = Math.max(
					1,
					Math.min(99, Math.floor(Number(body?.quantity) || 1)),
				);
				const options =
					body?.options && typeof body.options === "object"
						? Object.fromEntries(
								Object.entries(body.options as Record<string, unknown>).filter(
									(entry): entry is [string, string] =>
										typeof entry[1] === "string",
								),
							)
						: {};
				try {
					const cart = await bd.cart.forVisitor(cartVisitorToken()).addItem({
						productId,
						quantity,
						...(typeof body?.variantId === "string" && body.variantId
							? { variantId: body.variantId }
							: {}),
						...(Object.keys(options).length > 0 ? { options } : {}),
					});
					return json(200, { ok: true, itemCount: cart.itemCount });
				} catch {
					return json(502, {
						ok: false,
						error: "Couldn't add that to your cart. Try again.",
					});
				}
			},
		},
	},
});

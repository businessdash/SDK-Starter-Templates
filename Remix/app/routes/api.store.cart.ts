// [bd-file:store]
import type { ActionFunctionArgs } from "react-router";

import { addToCart } from "~/lib/bd-store.server";

/**
 * POST /api/store/cart — add to cart from the product page, as JSON:
 * `{ productId, variantId?, quantity, options? }` in, `{ ok, itemCount }` or
 * `{ ok: false, error }` out. The first add mints the visitor cookie, sent
 * back with the answer.
 */
export async function action({ request }: ActionFunctionArgs) {
	if (request.method !== "POST") {
		return Response.json({ ok: false, error: "Use POST." }, { status: 405 });
	}
	const body = (await request.json().catch(() => null)) as {
		productId?: unknown;
		variantId?: unknown;
		quantity?: unknown;
		options?: unknown;
	} | null;
	if (!body || typeof body.productId !== "string") {
		return Response.json(
			{ ok: false, error: "Which product?" },
			{ status: 400 },
		);
	}
	const quantity = Math.min(Math.max(Number(body.quantity) || 1, 1), 999);
	const options =
		body.options && typeof body.options === "object"
			? Object.fromEntries(
					Object.entries(body.options as Record<string, unknown>).filter(
						(entry): entry is [string, string] => typeof entry[1] === "string",
					),
				)
			: undefined;
	const result = await addToCart(request, {
		productId: body.productId,
		variantId: typeof body.variantId === "string" ? body.variantId : null,
		quantity,
		...(options ? { options } : {}),
	});
	if (!result.ok) {
		return Response.json({ ok: false, error: result.error }, { status: 502 });
	}
	const headers = new Headers();
	if (result.setCookie) headers.append("Set-Cookie", result.setCookie);
	return Response.json(
		{ ok: true, itemCount: result.snapshot.itemCount },
		{ headers },
	);
}

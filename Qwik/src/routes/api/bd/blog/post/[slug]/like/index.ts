// [bd-file:blog]
import type { RequestHandler } from "@builder.io/qwik-city";

import { getBd } from "../../../../../../../lib/bd";
import { getCustomerSession } from "../../../../../../../lib/bd-portal";

/**
 * Like the post for the signed-in customer, or take the like back:
 * `{ liked, likesCount }`, or `{ error }`. Signed out, it answers 401 and
 * `<bd-post-like>` offers the sign-in link.
 */
export const onPost: RequestHandler = async ({ params, request, cookie, json }) => {
	const bd = getBd();
	if (!bd) {
		json(503, { error: "The blog isn't connected yet." });
		return;
	}
	// A JSON body only: a form on another site can't send one.
	if (!request.headers.get("content-type")?.includes("application/json")) {
		json(415, { error: "Send JSON." });
		return;
	}
	const session = await getCustomerSession(cookie);
	if (!session) {
		json(401, { error: "Sign in to like posts." });
		return;
	}
	try {
		json(200, await bd.blog.withSession(session.token).toggleLike(params.slug));
	} catch {
		json(502, { error: "Couldn't save your like. Try again." });
	}
};

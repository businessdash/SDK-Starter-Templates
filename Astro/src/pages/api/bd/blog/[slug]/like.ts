// [bd-file:blog]
import type { APIRoute } from "astro";

import { toggleBlogLike } from "../../../../../lib/bd-blog";
import { getCustomerSession } from "../../../../../lib/bd-portal";

export const prerender = false;

/** POST /api/bd/blog/:slug/like — like or unlike, for the signed-in customer. */
export const POST: APIRoute = async ({ params, cookies }) => {
	const session = await getCustomerSession(cookies).catch(() => null);
	if (!session) {
		return Response.json({ error: "Sign in to like posts." }, { status: 401 });
	}
	try {
		return Response.json(await toggleBlogLike(params.slug ?? "", session.token));
	} catch {
		return Response.json(
			{ error: "Couldn't save your like. Try again." },
			{ status: 502 },
		);
	}
};

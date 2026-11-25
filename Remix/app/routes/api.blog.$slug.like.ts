// [bd-file:blog]
import type { ActionFunctionArgs } from "react-router";

import { toggleBlogLike } from "~/lib/bd-blog.server";
import { readSessionToken } from "~/lib/bd-portal.server";

/** POST /api/blog/:slug/like — like or unlike, for the signed-in customer. */
export async function action({ params, request }: ActionFunctionArgs) {
	const token = readSessionToken(request);
	if (!token) {
		return Response.json({ error: "Sign in to like posts." }, { status: 401 });
	}
	try {
		return Response.json(await toggleBlogLike(params["slug"] ?? "", token));
	} catch {
		return Response.json(
			{ error: "Couldn't save your like. Try again." },
			{ status: 502 },
		);
	}
}

// [bd-file:blog]
import { createFileRoute } from "@tanstack/solid-router";

import { getBd } from "../../../../lib/bd";
import { customerSession } from "../../../../lib/bd-server-fns";

function json(status: number, body: unknown): Response {
	return new Response(JSON.stringify(body), {
		status,
		headers: { "Content-Type": "application/json" },
	});
}

/**
 * Like the post for the signed-in customer, or take the like back:
 * `{ liked, likesCount }`, or `{ error }`. Signed out, it answers 401 and
 * `<bd-post-like>` offers the sign-in link.
 */
export const Route = createFileRoute("/api/bd/blog/post/$slug/like")({
	server: {
		handlers: {
			POST: async ({ request, params }) => {
				const bd = getBd();
				if (!bd) return json(503, { error: "The blog isn't connected yet." });
				// A JSON body only: a form on another site can't send one.
				if (
					!request.headers.get("content-type")?.includes("application/json")
				) {
					return json(415, { error: "Send JSON." });
				}
				const session = await customerSession();
				if (!session) return json(401, { error: "Sign in to like posts." });
				try {
					return json(
						200,
						await bd.blog.withSession(session.token).toggleLike(params.slug),
					);
				} catch {
					return json(502, { error: "Couldn't save your like. Try again." });
				}
			},
		},
	},
});

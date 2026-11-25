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
 * Comment as the signed-in customer. `{ content }` in; out, whether it shows
 * now or waits for approval, and the comments as they are now:
 * `{ ok, approved, comments }`, or `{ ok: false, error }`.
 */
export const Route = createFileRoute("/api/bd/blog/post/$slug/comment")({
	server: {
		handlers: {
			POST: async ({ request, params }) => {
				const bd = getBd();
				if (!bd)
					return json(503, {
						ok: false,
						error: "The blog isn't connected yet.",
					});
				if (
					!request.headers.get("content-type")?.includes("application/json")
				) {
					return json(415, { ok: false, error: "Send JSON." });
				}
				const session = await customerSession();
				if (!session)
					return json(401, { ok: false, error: "Sign in to comment." });
				const body = (await request.json().catch(() => null)) as {
					content?: unknown;
				} | null;
				const content =
					typeof body?.content === "string" ? body.content.trim() : "";
				if (!content)
					return json(400, { ok: false, error: "Write something first." });
				if (content.length > 5000) {
					return json(400, {
						ok: false,
						error: "Comments are up to 5,000 characters.",
					});
				}
				try {
					const posted = await bd.blog
						.withSession(session.token)
						.postComment(params.slug, { content });
					const comments = await bd.blog.listComments(params.slug, {
						limit: 50,
					});
					return json(200, {
						ok: true,
						approved: posted.moderation.isApproved,
						comments: comments.items,
					});
				} catch {
					return json(502, {
						ok: false,
						error: "Couldn't post your comment. Try again.",
					});
				}
			},
		},
	},
});

// [bd-file:blog]
import type { RequestHandler } from "@builder.io/qwik-city";

import { getBd } from "../../../../../../../lib/bd";
import { getCustomerSession } from "../../../../../../../lib/bd-portal";

/**
 * Comment as the signed-in customer. `{ content }` in; out, whether it shows
 * now or waits for approval, and the comments as they are now:
 * `{ ok, approved, comments }`, or `{ ok: false, error }`.
 */
export const onPost: RequestHandler = async ({ params, request, cookie, json }) => {
	const bd = getBd();
	if (!bd) {
		json(503, { ok: false, error: "The blog isn't connected yet." });
		return;
	}
	if (!request.headers.get("content-type")?.includes("application/json")) {
		json(415, { ok: false, error: "Send JSON." });
		return;
	}
	const session = await getCustomerSession(cookie);
	if (!session) {
		json(401, { ok: false, error: "Sign in to comment." });
		return;
	}
	const body = (await request.json().catch(() => null)) as { content?: unknown } | null;
	const content = typeof body?.content === "string" ? body.content.trim() : "";
	if (!content) {
		json(400, { ok: false, error: "Write something first." });
		return;
	}
	if (content.length > 5000) {
		json(400, { ok: false, error: "Comments are up to 5,000 characters." });
		return;
	}
	try {
		const posted = await bd.blog.withSession(session.token).postComment(params.slug, { content });
		const comments = await bd.blog.listComments(params.slug, { limit: 50 });
		json(200, { ok: true, approved: posted.moderation.isApproved, comments: comments.items });
	} catch {
		json(502, { ok: false, error: "Couldn't post your comment. Try again." });
	}
};

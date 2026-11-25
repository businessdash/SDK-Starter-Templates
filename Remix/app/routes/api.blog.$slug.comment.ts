// [bd-file:blog]
import type { ActionFunctionArgs } from "react-router";

import { listBlogComments, postBlogComment } from "~/lib/bd-blog.server";
import { readSessionToken } from "~/lib/bd-portal.server";

/**
 * POST /api/blog/:slug/comment — `{ content }` in; out, whether it shows
 * now or waits for approval, and the comments as they are now.
 */
export async function action({ params, request }: ActionFunctionArgs) {
	const slug = params["slug"] ?? "";
	const token = readSessionToken(request);
	if (!token) {
		return Response.json(
			{ ok: false, error: "Sign in to comment." },
			{ status: 401 },
		);
	}
	const body = (await request.json().catch(() => null)) as {
		content?: unknown;
	} | null;
	const content = typeof body?.content === "string" ? body.content.trim() : "";
	if (!content) {
		return Response.json(
			{ ok: false, error: "Write something first." },
			{ status: 400 },
		);
	}
	if (content.length > 5000) {
		return Response.json(
			{ ok: false, error: "Comments are up to 5,000 characters." },
			{ status: 400 },
		);
	}
	try {
		const { approved } = await postBlogComment(slug, token, content);
		const comments = await listBlogComments(slug);
		return Response.json({ ok: true, approved, comments: comments.items });
	} catch {
		return Response.json(
			{ ok: false, error: "Couldn't post your comment. Try again." },
			{ status: 502 },
		);
	}
}

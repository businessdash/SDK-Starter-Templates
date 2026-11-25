// [bd-file:blog]
import type { APIRoute } from "astro";

import { listBlogComments, postBlogComment } from "../../../../../lib/bd-blog";
import { getCustomerSession } from "../../../../../lib/bd-portal";

export const prerender = false;

/**
 * POST /api/bd/blog/:slug/comment — `{ content }` in; out, whether it shows
 * now or waits for approval, and the comments as they are now.
 */
export const POST: APIRoute = async ({ params, request, cookies }) => {
	const slug = params.slug ?? "";
	const session = await getCustomerSession(cookies).catch(() => null);
	if (!session) {
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
		const { approved } = await postBlogComment(slug, session.token, content);
		const comments = await listBlogComments(slug);
		return Response.json({ ok: true, approved, comments: comments.items });
	} catch {
		return Response.json(
			{ ok: false, error: "Couldn't post your comment. Try again." },
			{ status: 502 },
		);
	}
};

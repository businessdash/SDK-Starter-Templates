// [bd-file:blog]
/**
 * POST /api/bd/blog/post/[slug]/comment  { content }
 *
 * Posts a comment as the signed-in customer. `approved` is false when the
 * business reviews comments first, so the page can say it shows later.
 */
export default defineEventHandler(async (event) => {
	const bd = getBd();
	const slug = getRouterParam(event, "slug");
	const session = await getCustomerSession(event).catch(() => null);
	if (!bd || !slug || !session) {
		throw createError({ statusCode: 401, statusMessage: "Sign in to comment." });
	}
	const body = await readBody<{ content?: unknown }>(event);
	const content = typeof body?.content === "string" ? body.content.trim() : "";
	if (!content || content.length > 5000) {
		throw createError({
			statusCode: 400,
			statusMessage: "Comments are 1 to 5,000 characters.",
		});
	}
	const res = await bd.blog.withSession(session.token).postComment(slug, { content });
	return { approved: res.moderation.isApproved };
});

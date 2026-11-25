// [bd-file:blog]
/**
 * POST /api/bd/blog/post/[slug]/like
 *
 * Likes the post for the signed-in customer, or takes the like back.
 * Signed out, it answers 401 and the page offers the sign-in link.
 */
export default defineEventHandler(async (event) => {
	const bd = getBd();
	const slug = getRouterParam(event, "slug");
	const session = await getCustomerSession(event).catch(() => null);
	if (!bd || !slug || !session) {
		throw createError({ statusCode: 401, statusMessage: "Sign in to like posts." });
	}
	return bd.blog.withSession(session.token).toggleLike(slug);
});

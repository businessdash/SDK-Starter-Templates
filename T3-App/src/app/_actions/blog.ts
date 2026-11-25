// [bd-file:blog]
"use server";

import type { BlogLikeResponse } from "@businessdash/sdk/contracts";
import { cookies } from "next/headers";

import type { CommentResult } from "@/app/_components/bd/blog/BlogPost";
import {
	listBlogComments,
	postBlogComment,
	toggleBlogLike,
} from "@/server/lib/bd-blog";
import { SESSION_COOKIE } from "@/server/lib/bd-portal";

/**
 * Liking and commenting, for the signed-in customer. The session cookie is
 * read here on the server; BusinessDash checks it, so a stale one gets a
 * "sign in" answer rather than an error page.
 */

async function sessionToken(): Promise<string | null> {
	return (await cookies()).get(SESSION_COOKIE)?.value ?? null;
}

export async function likePostAction(
	slug: string,
): Promise<BlogLikeResponse | { error: string }> {
	const token = await sessionToken();
	if (!token) return { error: "Sign in to like posts." };
	try {
		return await toggleBlogLike(slug, token);
	} catch {
		return { error: "Couldn't save your like. Try again." };
	}
}

export async function commentOnPostAction(
	slug: string,
	content: string,
): Promise<CommentResult> {
	const token = await sessionToken();
	if (!token) return { ok: false, error: "Sign in to comment." };
	const text = content.trim();
	if (!text) return { ok: false, error: "Write something first." };
	if (text.length > 5000) {
		return { ok: false, error: "Comments are up to 5,000 characters." };
	}
	try {
		const { approved } = await postBlogComment(slug, token, text);
		const comments = await listBlogComments(slug);
		return { ok: true, approved, comments: comments.items };
	} catch {
		return { ok: false, error: "Couldn't post your comment. Try again." };
	}
}

"use server";

import { z } from "zod";

import type {
	ReviewSendResult,
	ReviewToSend,
} from "@/app/_components/bd/reviews/ReviewWriter";
import { checkReview } from "@/app/_components/bd/reviews/reviews";
import {
	getCustomerSession,
	isCustomerPortalConfigured,
	submitCustomerReview,
} from "@/server/lib/bd-portal";

/**
 * Customer review submission (signed-in customer portal). Validates input,
 * submits via the BD portal, and lands as `status: 'pending'` until staff
 * moderate. `submitReviewAction` serves the my-account review form;
 * `writeReviewAction` the reviews page's writer.
 */

const reviewSchema = z.object({
	rating: z.coerce.number().int().min(1).max(5),
	title: z.string().trim().max(200).optional(),
	body: z.string().trim().min(1, "Please write a few words.").max(5000),
	jobId: z
		.string()
		.uuid()
		.optional()
		.or(z.literal("").transform(() => undefined)),
});

export type ReviewFormState =
	| { status: "idle" }
	| { status: "success"; message: string; reviewStatus?: string }
	| {
			status: "error";
			message: string;
			fieldErrors?: Partial<Record<"rating" | "title" | "body", string>>;
	  };

export async function submitReviewAction(
	_prev: ReviewFormState,
	formData: FormData,
): Promise<ReviewFormState> {
	if (!isCustomerPortalConfigured()) {
		return {
			status: "error",
			message: "Reviews aren't available right now. Please check back soon.",
		};
	}

	const parsed = reviewSchema.safeParse({
		rating: formData.get("rating"),
		title: formData.get("title") || undefined,
		body: formData.get("body"),
		jobId: formData.get("jobId") || undefined,
	});

	if (!parsed.success) {
		const flat = z.flattenError(parsed.error).fieldErrors;
		return {
			status: "error",
			message: "Please fix the highlighted fields.",
			fieldErrors: {
				rating: flat.rating?.[0],
				title: flat.title?.[0],
				body: flat.body?.[0],
			},
		};
	}

	try {
		const res = await submitCustomerReview(parsed.data);
		return {
			status: "success",
			message:
				"Thanks! Your review was submitted and will appear once it's approved.",
			reviewStatus: res.status,
		};
	} catch (err) {
		if (process.env.NODE_ENV === "development") {
			const reason = err instanceof Error ? err.message : String(err);
			console.warn(`[bd] submitReview failed: ${reason}`);
		}
		return {
			status: "error",
			message:
				"We couldn't submit your review. You may need to be signed in to your account.",
		};
	}
}

/**
 * A review from the reviews page's writer, checked again with the shared
 * rules. Signed out, it says so, and the writer offers sign-in.
 */
export async function writeReviewAction(
	input: ReviewToSend,
): Promise<ReviewSendResult> {
	if (!isCustomerPortalConfigured()) {
		return { ok: false, error: "Reviews aren't connected yet." };
	}
	if (!(await getCustomerSession().catch(() => null))) {
		return { ok: false, error: "Sign in to write a review.", signedOut: true };
	}
	const checked = checkReview(input);
	if (!checked.ok) return { ok: false, error: checked.error };
	try {
		await submitCustomerReview(checked.review);
		return { ok: true };
	} catch {
		return { ok: false, error: "Couldn't send your review. Try again." };
	}
}

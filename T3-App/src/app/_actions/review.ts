"use server";

import { z } from "zod";

import {
	isCustomerPortalConfigured,
	submitCustomerReview,
} from "@/server/lib/biab-portal";

/**
 * Customer review submission (signed-in customer portal). Validates input,
 * submits via the BIAB portal, and lands as `status: 'pending'` until staff
 * moderate. Called from the my-account review form.
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

export const initialReviewFormState: ReviewFormState = { status: "idle" };

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
		const flat = parsed.error.flatten().fieldErrors;
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
			console.warn(`[biab] submitReview failed: ${reason}`);
		}
		return {
			status: "error",
			message:
				"We couldn't submit your review. You may need to be signed in to your account.",
		};
	}
}

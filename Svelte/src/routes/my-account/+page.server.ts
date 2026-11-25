import { fail } from '@sveltejs/kit';
import { z } from 'zod';

import type { Actions, PageServerLoad } from './$types';

import { SESSION_COOKIE } from '#lib/server/bd-portal.ts';
import {
	getCustomerSession,
	getCustomerWork,
	isCustomerPortalConfigured,
	submitCustomerReview
} from '#lib/server/bd-portal.ts';
// [bd:subscriptions]
import { getCustomerSubscription, setPlanCancelled } from '#lib/server/bd-portal.ts';
// [/bd:subscriptions]

/**
 * Customer portal. Reads + validates the `bd_session` cookie via
 * `getTenantSession`, then loads the signed-in customer's work bundle
 * (`getWork()`). The review-submit form posts to the `submitReview`
 * action below. Signed-out / unconfigured states render a sign-in prompt.
 */
export const load: PageServerLoad = async ({ cookies }) => {
	if (!isCustomerPortalConfigured()) {
		return {
			configured: false as const,
			session: null,
			work: null,
			// [bd:subscriptions]
			plan: null,
			// [/bd:subscriptions]
		};
	}
	const cookieValue = cookies.get(SESSION_COOKIE);
	const session = await getCustomerSession(cookieValue);
	if (!session) {
		return {
			configured: true as const,
			session: null,
			work: null,
			// [bd:subscriptions]
			plan: null,
			// [/bd:subscriptions]
		};
	}
	const work = await getCustomerWork(cookieValue);
	// [bd:subscriptions]
	const plan = await getCustomerSubscription(cookieValue);
	// [/bd:subscriptions]
	return {
		configured: true as const,
		// Only hand the client the display-safe fields — never the token.
		session: { user: session.user, role: session.role },
		work,
		// [bd:subscriptions]
		plan,
		// [/bd:subscriptions]
	};
};

/** Discriminated form-state for the review action. A uniform shape lets the
 *  page narrow on `status` and reach `fieldErrors` without type errors. */
export type ReviewFieldErrors = Partial<Record<'rating' | 'title' | 'body', string | undefined>>;
export type ReviewState =
	| { status: 'success'; message: string; reviewStatus?: string }
	| { status: 'error'; message: string; fieldErrors: ReviewFieldErrors };

// [bd:subscriptions]
/** Result of cancelling a plan, or taking the cancel back. */
export type PlanChangeState =
	| { status: 'ok'; cancelAtPeriodEnd: boolean; accessUntil: string | null }
	| { status: 'error'; message: string };

async function changePlan(cookieValue: string | undefined, cancel: boolean) {
	try {
		const res = await setPlanCancelled(cookieValue, cancel);
		return {
			planChange: {
				status: 'ok',
				cancelAtPeriodEnd: res.cancelAtPeriodEnd,
				accessUntil: res.accessUntil
			} satisfies PlanChangeState
		};
	} catch {
		return fail(400, {
			planChange: {
				status: 'error',
				message: "We couldn't change your plan. Please try again."
			} satisfies PlanChangeState
		});
	}
}
// [/bd:subscriptions]

const reviewSchema = z.object({
	rating: z.coerce.number().int().min(1).max(5),
	title: z.string().trim().max(200).optional(),
	body: z.string().trim().min(1, 'Please write a few words.').max(5000),
	jobId: z
		.string()
		.uuid()
		.optional()
		.or(z.literal('').transform(() => undefined))
});

export const actions: Actions = {
	// [bd:subscriptions]
	/** Stop the renewal. Access runs to the end of the paid period. */
	cancelPlan: async ({ cookies }) => changePlan(cookies.get(SESSION_COOKIE), true),
	/** Take a pending cancel back. */
	resumePlan: async ({ cookies }) => changePlan(cookies.get(SESSION_COOKIE), false),
	// [/bd:subscriptions]
	/** Validate + submit a customer review via the BD portal. */
	submitReview: async ({ request, cookies }) => {
		if (!isCustomerPortalConfigured()) {
			return fail(503, {
				review: {
					status: 'error',
					message: "Reviews aren't available right now.",
					fieldErrors: {}
				} satisfies ReviewState
			});
		}
		const form = await request.formData();
		const parsed = reviewSchema.safeParse({
			rating: form.get('rating'),
			title: form.get('title') || undefined,
			body: form.get('body'),
			jobId: form.get('jobId') || undefined
		});
		if (!parsed.success) {
			const flat = z.flattenError(parsed.error).fieldErrors;
			const fieldErrors: ReviewFieldErrors = {
				rating: flat.rating?.[0],
				title: flat.title?.[0],
				body: flat.body?.[0]
			};
			return fail(400, {
				review: {
					status: 'error',
					message: 'Please fix the highlighted fields.',
					fieldErrors
				} satisfies ReviewState
			});
		}
		try {
			const res = await submitCustomerReview(cookies.get(SESSION_COOKIE), parsed.data);
			return {
				review: {
					status: 'success',
					message: "Thanks! Your review was submitted and will appear once it's approved.",
					reviewStatus: res.status
				} satisfies ReviewState
			};
		} catch {
			return fail(400, {
				review: {
					status: 'error',
					message: "We couldn't submit your review. You may need to be signed in.",
					fieldErrors: {}
				} satisfies ReviewState
			});
		}
	}
};

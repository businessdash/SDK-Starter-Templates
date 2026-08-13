"use client";

import { useActionState } from "react";

import {
	initialReviewFormState,
	submitReviewAction,
} from "@/app/_actions/review";

/**
 * Customer review form — submits via the `submitReviewAction` Server Action
 * (the BIAB customer portal). The review lands as `pending` until staff
 * moderate. `jobId` ties the review to a specific job when rendered inside a
 * job card.
 */
export function ReviewForm({ jobId }: { jobId?: string }) {
	const [state, action, pending] = useActionState(
		submitReviewAction,
		initialReviewFormState,
	);

	if (state.status === "success") {
		return (
			<div className="biab-card review-form review-form--done">
				<span className="biab-badge">Submitted</span>
				<p>{state.message}</p>
			</div>
		);
	}

	const fieldErrors = state.status === "error" ? state.fieldErrors : undefined;

	return (
		<form action={action} className="biab-card review-form">
			{jobId ? <input name="jobId" type="hidden" value={jobId} /> : null}

			<div>
				<label className="biab-label" htmlFor="rating">
					Rating
				</label>
				<select
					className="biab-select"
					defaultValue="5"
					id="rating"
					name="rating"
				>
					{[5, 4, 3, 2, 1].map((n) => (
						<option key={n} value={n}>
							{"★".repeat(n)} ({n})
						</option>
					))}
				</select>
				{fieldErrors?.rating ? (
					<small className="review-form__err">{fieldErrors.rating}</small>
				) : null}
			</div>

			<div>
				<label className="biab-label" htmlFor="title">
					Title (optional)
				</label>
				<input
					className="biab-input"
					id="title"
					name="title"
					placeholder="Great service"
				/>
			</div>

			<div>
				<label className="biab-label" htmlFor="body">
					Your review
				</label>
				<textarea
					className="biab-textarea"
					id="body"
					name="body"
					placeholder="Tell us how it went…"
					required
				/>
				{fieldErrors?.body ? (
					<small className="review-form__err">{fieldErrors.body}</small>
				) : null}
			</div>

			<button className="biab-btn" disabled={pending} type="submit">
				{pending ? "Submitting…" : "Submit review"}
			</button>

			{state.status === "error" && !fieldErrors ? (
				<p className="review-form__err">{state.message}</p>
			) : null}
		</form>
	);
}

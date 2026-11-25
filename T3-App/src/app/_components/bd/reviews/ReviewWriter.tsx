"use client";

import { type FormEvent, useEffect, useRef, useState } from "react";

import { checkReview, REVIEW_MAX_LENGTH, REVIEW_SENT } from "./reviews";

export type ReviewToSend = { rating: number; title?: string; body: string };
export type ReviewSendResult =
	| { ok: true }
	| { ok: false; error: string; signedOut?: boolean };

/**
 * A signed-in customer writes a review of the business; it waits for the
 * business to approve it. Signed out, it's a link to sign in. `send` is the
 * framework's way to the server (a server action, a route action, a POST),
 * which checks the review again.
 */
export function ReviewWriter({
	signedIn,
	signInHref,
	send,
}: {
	signedIn: boolean;
	signInHref: string;
	send: (review: ReviewToSend) => Promise<ReviewSendResult>;
}) {
	const [open, setOpen] = useState(false);
	const [rating, setRating] = useState(0);
	const [sending, setSending] = useState(false);
	const [sent, setSent] = useState(false);
	const [error, setError] = useState("");
	const [signedOut, setSignedOut] = useState(!signedIn);
	const form = useRef<HTMLFormElement>(null);

	useEffect(() => {
		if (open)
			form.current
				?.querySelector<HTMLButtonElement>(".review-writer__star")
				?.focus();
	}, [open]);

	async function submit(event: FormEvent<HTMLFormElement>) {
		event.preventDefault();
		if (sending) return;
		const fields = new FormData(event.currentTarget);
		const checked = checkReview({
			rating,
			title: fields.get("title"),
			body: fields.get("body"),
		});
		if (!checked.ok) {
			setError(checked.error);
			return;
		}
		setSending(true);
		setError("");
		try {
			const result = await send(checked.review);
			if (result.ok) setSent(true);
			else if (result.signedOut) setSignedOut(true);
			else setError(result.error);
		} catch {
			setError("Couldn't send your review. Try again.");
		} finally {
			setSending(false);
		}
	}

	if (sent) {
		return (
			<p className="review-writer__sent" role="status">
				{REVIEW_SENT}
			</p>
		);
	}
	if (signedOut) {
		return (
			<a className="bd-btn bd-btn--ghost" href={signInHref}>
				Sign in to write a review
			</a>
		);
	}
	if (!open) {
		return (
			<button className="bd-btn" onClick={() => setOpen(true)} type="button">
				Write a review
			</button>
		);
	}
	return (
		<form className="review-writer" onSubmit={submit} ref={form}>
			<fieldset className="review-writer__stars">
				<legend className="bd-label">Your rating</legend>
				{[1, 2, 3, 4, 5].map((star) => (
					<button
						aria-label={`${star} ${star === 1 ? "star" : "stars"}`}
						aria-pressed={rating === star}
						className={`review-writer__star${star <= rating ? " is-on" : ""}`}
						key={star}
						onClick={() => {
							setRating(star);
							setError("");
						}}
						type="button"
					>
						{star <= rating ? "★" : "☆"}
					</button>
				))}
			</fieldset>
			<label className="bd-label" htmlFor="review-title">
				Title (optional)
			</label>
			<input
				className="bd-input"
				id="review-title"
				maxLength={200}
				name="title"
			/>
			<label className="bd-label" htmlFor="review-body">
				Your review
			</label>
			<textarea
				className="bd-textarea"
				id="review-body"
				maxLength={REVIEW_MAX_LENGTH}
				name="body"
				required
				rows={5}
			/>
			<button className="bd-btn" disabled={sending} type="submit">
				{sending ? "Sending…" : "Send review"}
			</button>
			{error ? (
				<p className="review-writer__error" role="alert">
					{error}
				</p>
			) : null}
		</form>
	);
}

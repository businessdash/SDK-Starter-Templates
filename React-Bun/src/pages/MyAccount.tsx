import { useState } from "react";
import { biab } from "../lib/biab";
import type { Loose } from "../lib/biab";
import { ErrorBox, PageHead, useApi } from "./ui";

export function MyAccount() {
	const { data, error, loading } = useApi(() => biab.portal.work());
	const [rating, setRating] = useState("5");
	const [body, setBody] = useState("");
	const [msg, setMsg] = useState("");
	const [submitting, setSubmitting] = useState(false);

	const submit = async () => {
		if (!body.trim()) {
			setMsg("Please write a short review first.");
			return;
		}
		setSubmitting(true);
		setMsg("Submitting…");
		try {
			const res: Loose = await biab.portal.submitReview({ rating: Number(rating), body: body.trim() });
			setMsg(res?.status === "pending" ? "Thanks! Your review is pending moderation." : "Thanks for your review!");
			setBody("");
		} catch (e: any) {
			setMsg(e?.message ?? "Couldn't submit your review.");
		} finally {
			setSubmitting(false);
		}
	};

	if (loading)
		return (
			<main className="page">
				<PageHead title="My account" />
				<p className="muted">Loading…</p>
			</main>
		);
	if (error)
		return (
			<main className="page">
				<PageHead title="My account" />
				<ErrorBox error={error} />
			</main>
		);

	if (!data?.signedIn) {
		return (
			<main className="page">
				<PageHead title="My account" />
				<div className="signin-card">
					<p>You're not signed in.</p>
					<div className="signin-card__actions">
						<a className="btn btn--primary" href="/api/biab-auth/sign-in">
							Sign in
						</a>
						<a className="btn btn--ghost" href="/api/biab-auth/sign-up">
							Create account
						</a>
					</div>
				</div>
			</main>
		);
	}

	const u: Loose = data.user ?? {};
	const work: Loose = data.work ?? {};
	const jobs: Record<string, any>[] = work.jobs ?? work.items ?? [];

	return (
		<main className="page">
			<PageHead title="My account" />
			<div className="account-head">
				<p>
					Signed in as <strong>{u.firstName || u.email || "customer"}</strong>
				</p>
				<a className="btn btn--ghost btn--sm" href="/api/biab-auth/sign-out">
					Sign out
				</a>
			</div>
			<h2 className="section-title">Your work</h2>
			{jobs.length === 0 ? (
				<p className="muted">{work.unlinked ? "Your account isn't linked to any jobs yet." : "No jobs on file yet."}</p>
			) : (
				<ul className="job-list">
					{jobs.map((j, i) => (
						<li key={j.id ?? i} className="job-row">
							<span className="job-row__name">{j.name ?? j.title ?? j.jobName ?? "Job"}</span>
							{j.status ? <span className="job-row__status">{String(j.status)}</span> : null}
						</li>
					))}
				</ul>
			)}
			<section className="review-form">
				<h2 className="section-title">Leave a review</h2>
				<div className="rf__row">
					<select className="rf__rating" aria-label="Rating" value={rating} onChange={(e) => setRating(e.target.value)}>
						{[5, 4, 3, 2, 1].map((n) => (
							<option key={n} value={String(n)}>
								{n} ★
							</option>
						))}
					</select>
				</div>
				<textarea
					className="rf__text"
					rows={4}
					placeholder="Tell us about your experience…"
					value={body}
					onChange={(e) => setBody(e.target.value)}
				/>
				<button className="btn btn--primary" type="button" disabled={submitting} onClick={submit}>
					Submit review
				</button>
				<p className="rf__msg">{msg}</p>
			</section>
		</main>
	);
}

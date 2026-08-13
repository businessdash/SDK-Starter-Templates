import { Form, useActionData, useLoaderData, useNavigation } from "react-router";
import type {
	ActionFunctionArgs,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import { SiteHeader } from "~/components/SiteHeader";
import {
	getCustomerSession,
	getCustomerWork,
	isCustomerPortalConfigured,
	submitCustomerReview,
} from "~/lib/biab-portal.server";

export const meta: MetaFunction = () => [
	{ title: "My account — Your Business" },
];

export async function loader({ request }: LoaderFunctionArgs) {
	const configured = isCustomerPortalConfigured();
	const session = await getCustomerSession(request);
	if (!session) {
		return { configured, signedIn: false as const };
	}
	const work = await getCustomerWork(request);
	return {
		configured,
		signedIn: true as const,
		user: session.user,
		unlinked: work?.unlinked ?? true,
		summary: work?.summary ?? null,
		jobs: (work?.jobs ?? []).slice(0, 10).map((j) => {
			const job = j as Record<string, unknown>;
			return {
				id: typeof job["id"] === "string" ? (job["id"] as string) : "",
				title:
					typeof job["title"] === "string"
						? (job["title"] as string)
						: typeof job["name"] === "string"
							? (job["name"] as string)
							: "Job",
				status:
					typeof job["status"] === "string" ? (job["status"] as string) : "",
			};
		}),
	};
}

export async function action({ request }: ActionFunctionArgs) {
	const fd = await request.formData();
	const rating = Number.parseInt(String(fd.get("rating") ?? "5"), 10);
	const title = (String(fd.get("title") ?? "").trim() || undefined) as
		| string
		| undefined;
	const body = String(fd.get("body") ?? "").trim();
	const jobId = (String(fd.get("jobId") ?? "").trim() || undefined) as
		| string
		| undefined;
	if (!body) {
		return { status: "error" as const, message: "Please write a few words." };
	}
	try {
		const res = await submitCustomerReview(request, {
			rating: Math.min(5, Math.max(1, rating)),
			title,
			body,
			jobId,
		});
		return {
			status: "success" as const,
			message: "Thanks! Your review will appear once approved.",
			reviewStatus: res.status,
		};
	} catch {
		return {
			status: "error" as const,
			message:
				"We couldn't submit your review. You may need to sign in again.",
		};
	}
}

export default function MyAccount() {
	const data = useLoaderData<typeof loader>();
	const actionData = useActionData<typeof action>();
	const nav = useNavigation();
	const submitting = nav.state === "submitting";

	return (
		<>
			<SiteHeader />
			<main>
				<section className="section">
					<h1 className="section__title">My account</h1>

					{!data.configured ? (
						<p className="muted">
							Customer accounts aren't connected yet. Set BIAB_AUTH_CALLBACK_URL
							to enable sign-in.
						</p>
					) : !data.signedIn ? (
						<div className="card">
							<p>You're not signed in.</p>
							{/* Auth endpoints are resource routes — use plain links. */}
							<p>
								<a className="biab-btn" href="/api/biab-auth/sign-in">
									Sign in
								</a>{" "}
								<a className="muted" href="/api/biab-auth/sign-up">
									or create an account
								</a>
							</p>
						</div>
					) : (
						<>
							<div className="card">
								<h3>
									{data.user.firstName ?? ""} {data.user.lastName ?? ""}
								</h3>
								<p className="muted">{data.user.email}</p>
								<p>
									<a className="muted" href="/api/biab-auth/sign-out">
										Sign out
									</a>
								</p>
							</div>

							<h2 className="section__subtitle">Your work</h2>
							{data.unlinked ? (
								<p className="muted">
									Your account isn't linked to a customer record yet. New jobs
									and invoices will show here once it is.
								</p>
							) : (
								<>
									{data.summary ? (
										<ul className="stat-row">
											<li>Open jobs: {data.summary.openJobCount}</li>
											<li>Pending quotes: {data.summary.pendingQuoteCount}</li>
											<li>Unpaid invoices: {data.summary.unpaidInvoiceCount}</li>
										</ul>
									) : null}
									{data.jobs.length > 0 ? (
										<ul className="post-list">
											{data.jobs.map((j) => (
												<li key={j.id}>
													<strong>{j.title}</strong>
													{j.status ? (
														<span className="muted"> · {j.status}</span>
													) : null}
												</li>
											))}
										</ul>
									) : (
										<p className="muted">No jobs yet.</p>
									)}
								</>
							)}

							<h2 className="section__subtitle">Leave a review</h2>
							{actionData?.status === "success" ? (
								<p className="muted">{actionData.message}</p>
							) : (
								<Form method="post">
									<label>
										Rating
										<select name="rating" defaultValue="5">
											{[5, 4, 3, 2, 1].map((n) => (
												<option value={n} key={n}>
													{n} star{n === 1 ? "" : "s"}
												</option>
											))}
										</select>
									</label>
									<label>
										Title (optional)
										<input name="title" />
									</label>
									<label>
										Your review
										<textarea name="body" rows={4} required />
									</label>
									{data.jobs.length > 0 ? (
										<label>
											About a job (optional)
											<select name="jobId" defaultValue="">
												<option value="">— none —</option>
												{data.jobs.map((j) => (
													<option value={j.id} key={j.id}>
														{j.title}
													</option>
												))}
											</select>
										</label>
									) : null}
									<button className="biab-btn" type="submit" disabled={submitting}>
										{submitting ? "Submitting…" : "Submit review"}
									</button>
									{actionData?.status === "error" ? (
										<p className="error">{actionData.message}</p>
									) : null}
								</Form>
							)}
						</>
					)}
				</section>
			</main>
		</>
	);
}

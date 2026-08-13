import type { CustomerJobSummary } from "@businessdash/sdk/contracts";
import type { Metadata } from "next";

import { AuthButtons, SignOutLink } from "@/app/_components/biab/AuthButtons";
import { BiabFooter } from "@/app/_components/biab/Footer";
import { ReviewForm } from "@/app/_components/biab/ReviewForm";
import {
	getCustomerSession,
	getCustomerWork,
	isCustomerPortalConfigured,
} from "@/server/lib/biab-portal";

export const metadata: Metadata = {
	title: "My Account",
	description: "Your jobs, quotes, and invoices.",
};

// Per-customer + reads the `biab_session` cookie — never statically cache.
export const dynamic = "force-dynamic";

function formatDate(iso: string | null): string | null {
	if (!iso) return null;
	const t = Date.parse(iso);
	if (Number.isNaN(t)) return null;
	return new Date(t).toLocaleDateString("en-US", {
		year: "numeric",
		month: "short",
		day: "numeric",
	});
}

function prettyStatus(status: string): string {
	return status.replace(/[_-]+/g, " ").replace(/\b\w/g, (c) => c.toUpperCase());
}

function JobCard({
	job,
	completed,
}: {
	job: CustomerJobSummary;
	completed: boolean;
}) {
	const started = formatDate(job.startDate);
	const due = formatDate(job.dueDate);
	const done = formatDate(job.statusCompletedAt);
	return (
		<li className="biab-card account-job">
			<div className="account-job__head">
				<div>
					<h3>{job.name?.trim() || "Service job"}</h3>
					<p className="account-job__meta">
						{prettyStatus(job.status)}
						{done
							? ` · Completed ${done}`
							: started
								? ` · Started ${started}`
								: ""}
						{!completed && due ? ` · Due ${due}` : ""}
					</p>
				</div>
				<span className={`biab-badge ${completed ? "" : "biab-badge--active"}`}>
					{completed ? "Completed" : "In progress"}
				</span>
			</div>

			<details className="account-job__review">
				<summary>★ Leave a review</summary>
				<div>
					<ReviewForm jobId={job.id} />
				</div>
			</details>
		</li>
	);
}

export default async function MyAccountPage() {
	const configured = isCustomerPortalConfigured();
	const session = configured ? await getCustomerSession() : null;

	return (
		<>
			<main className="biab-section biab-section--narrow account">
				<div className="account__head">
					<div>
						<span className="biab-section__eyebrow">Account</span>
						<h1 className="biab-section__title">My account</h1>
						<p className="biab-section__sub">
							{session?.user.firstName
								? `Welcome back, ${session.user.firstName}.`
								: "Your jobs, quotes, and invoices live here."}
						</p>
					</div>
					{session ? <SignOutLink /> : null}
				</div>

				{!configured ? (
					<div className="biab-empty">
						Accounts aren&apos;t available right now — set
						BIAB_AUTH_CALLBACK_URL (and the BIAB API key + base URL) to enable
						customer sign-in.
					</div>
				) : !session ? (
					<div className="biab-card account__signedout">
						<p>Sign in to see your jobs, quotes, and invoices.</p>
						<AuthButtons />
					</div>
				) : (
					<AccountWork />
				)}
			</main>
			<BiabFooter />
		</>
	);
}

async function AccountWork() {
	const work = await getCustomerWork();
	const jobs = work?.jobs ?? [];
	const current = jobs.filter((j) => !j.statusCompletedAt);
	const former = jobs.filter((j) => j.statusCompletedAt);

	if (work?.unlinked) {
		return (
			<div className="biab-empty">
				We couldn&apos;t find any jobs linked to your account yet. Once
				we&apos;ve started work for you, it&apos;ll show up here.
			</div>
		);
	}

	if (jobs.length === 0) {
		return <div className="biab-empty">You don&apos;t have any jobs yet.</div>;
	}

	return (
		<div className="account__work">
			{current.length > 0 ? (
				<section>
					<h2 className="account__sectionTitle">Current jobs</h2>
					<ul className="account__list">
						{current.map((job) => (
							<JobCard completed={false} job={job} key={job.id} />
						))}
					</ul>
				</section>
			) : null}

			{former.length > 0 ? (
				<section>
					<h2 className="account__sectionTitle">Past jobs</h2>
					<ul className="account__list">
						{former.map((job) => (
							<JobCard completed={true} job={job} key={job.id} />
						))}
					</ul>
				</section>
			) : null}
		</div>
	);
}

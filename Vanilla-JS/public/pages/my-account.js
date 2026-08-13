/** /my-account — customer portal: session, work bundle, review submission. */
import { biab, el } from "/biab.js";
import { errBox, pageHead } from "./_ui.js";

export default async function render(root) {
	root.replaceChildren(pageHead("My account"), el("p", { class: "page__loading" }, ["Loading…"]));
	let data;
	try {
		data = await biab.portal.work();
	} catch (err) {
		root.replaceChildren(pageHead("My account"), errBox(err));
		return;
	}

	const nodes = [pageHead("My account")];

	if (!data?.signedIn) {
		nodes.push(
			el("div", { class: "signin-card" }, [
				el("p", {}, ["You're not signed in."]),
				el("div", { class: "signin-card__actions" }, [
					el("a", { class: "btn btn--primary", href: "/api/biab-auth/sign-in" }, ["Sign in"]),
					el("a", { class: "btn btn--ghost", href: "/api/biab-auth/sign-up" }, ["Create account"]),
				]),
			]),
		);
		root.replaceChildren(...nodes);
		return;
	}

	const u = data.user ?? {};
	nodes.push(
		el("div", { class: "account-head" }, [
			el("p", {}, ["Signed in as ", el("strong", {}, [u.firstName || u.email || "customer"])]),
			el("a", { class: "btn btn--ghost btn--sm", href: "/api/biab-auth/sign-out" }, ["Sign out"]),
		]),
	);

	const work = data.work ?? {};
	const jobs = work.jobs ?? work.items ?? [];
	nodes.push(el("h2", { class: "section-title" }, ["Your work"]));
	if (!jobs.length) {
		nodes.push(
			el("p", { class: "muted" }, [work.unlinked ? "Your account isn't linked to any jobs yet." : "No jobs on file yet."]),
		);
	} else {
		nodes.push(el("ul", { class: "job-list" }, jobs.map(jobRow)));
	}

	nodes.push(reviewForm());
	root.replaceChildren(...nodes);
}

function jobRow(j) {
	return el("li", { class: "job-row" }, [
		el("span", { class: "job-row__name" }, [j.name ?? j.title ?? j.jobName ?? "Job"]),
		j.status ? el("span", { class: "job-row__status" }, [String(j.status)]) : null,
	]);
}

function reviewForm() {
	const rating = el(
		"select",
		{ class: "rf__rating", "aria-label": "Rating" },
		[5, 4, 3, 2, 1].map((n) => el("option", { value: String(n) }, [`${n} ★`])),
	);
	const text = el("textarea", { class: "rf__text", rows: "4", placeholder: "Tell us about your experience…" });
	const msg = el("p", { class: "rf__msg" }, []);
	const btn = el(
		"button",
		{
			class: "btn btn--primary",
			type: "button",
			onClick: async () => {
				if (!text.value.trim()) {
					msg.textContent = "Please write a short review first.";
					return;
				}
				btn.disabled = true;
				msg.textContent = "Submitting…";
				try {
					const res = await biab.portal.submitReview({ rating: Number(rating.value), body: text.value.trim() });
					msg.textContent =
						res?.status === "pending"
							? "Thanks! Your review is pending moderation."
							: "Thanks for your review!";
					text.value = "";
				} catch (err) {
					msg.textContent = err?.message ?? "Couldn't submit your review.";
				} finally {
					btn.disabled = false;
				}
			},
		},
		["Submit review"],
	);
	return el("section", { class: "review-form" }, [
		el("h2", { class: "section-title" }, ["Leave a review"]),
		el("div", { class: "rf__row" }, [rating]),
		text,
		btn,
		msg,
	]);
}

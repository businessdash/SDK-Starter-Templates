import { useEffect } from "react";

import type { ReviewsPageData } from "../components/reviews/reviews-page";
import { ReviewsView } from "../components/reviews/ReviewsView";
import {
	type ReviewSendResult,
	type ReviewToSend,
	ReviewWriter,
} from "../components/reviews/ReviewWriter";
import { useSearchParams } from "../lib/router";
import { ErrorBox, useApi } from "./ui";

/**
 * The business's reviews: the rating with a bar per star, a platform filter
 * (`?source=`), each review with its photos, Verified and a link to it on
 * Google or Yelp, "Show more" (`?shown=`), and writing one. The server
 * gathers the page (`GET /api/bd/reviews/page`) and takes a written review
 * (`POST /api/bd/reviews/write`); the rules are
 * `components/reviews/reviews.ts`, the same in every BD starter.
 */
export function Reviews() {
	const params = useSearchParams();
	const source = params.get("source") ?? "";
	const shown = params.get("shown") ?? "";
	const { data, error } = useApi(
		() => getReviewsPage(source, shown),
		[source, shown],
	);

	// "Show more" leads to the first new review, which is there once the
	// page has loaded.
	useEffect(() => {
		const id = decodeURIComponent(window.location.hash.slice(1));
		if (data && id) document.getElementById(id)?.scrollIntoView();
	}, [data]);

	return (
		<main className="bd-page">
			{error && !data ? (
				<ErrorBox error={error} />
			) : !data ? (
				<p className="bd-loading">Loading reviews…</p>
			) : (
				<ReviewsView
					data={data}
					writer={
						<ReviewWriter
							send={sendReview}
							signedIn={data.signedIn}
							signInHref="/my-account?next=%2Freviews"
						/>
					}
				/>
			)}
		</main>
	);
}

async function getReviewsPage(
	source: string,
	shown: string,
): Promise<ReviewsPageData> {
	const query = new URLSearchParams();
	if (source) query.set("source", source);
	if (shown) query.set("shown", shown);
	const search = query.toString();
	const res = await fetch(`/api/bd/reviews/page${search ? `?${search}` : ""}`);
	if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
	return (await res.json()) as ReviewsPageData;
}

/** The writer's `send`: the review as JSON to the server. */
async function sendReview(review: ReviewToSend): Promise<ReviewSendResult> {
	try {
		const res = await fetch("/api/bd/reviews/write", {
			method: "POST",
			headers: { "content-type": "application/json" },
			body: JSON.stringify(review),
		});
		const reply = (await res.json().catch(() => null)) as {
			ok?: boolean;
			error?: string;
		} | null;
		if (res.ok && reply?.ok) return { ok: true };
		return {
			ok: false,
			error: reply?.error ?? "Couldn't send your review. Try again.",
			signedOut: res.status === 401,
		};
	} catch {
		return { ok: false, error: "Couldn't send your review. Try again." };
	}
}

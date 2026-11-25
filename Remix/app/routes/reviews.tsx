import { useLoaderData } from "react-router";
import type {
	LinksFunction,
	LoaderFunctionArgs,
	MetaFunction,
} from "react-router";

import reviewStyles from "~/bd-reviews.css?url";
import { SiteHeader } from "~/components/SiteHeader";
import { ReviewsView } from "~/components/reviews/ReviewsView";
import {
	type ReviewSendResult,
	type ReviewToSend,
	ReviewWriter,
} from "~/components/reviews/ReviewWriter";
import { loadReviewsPage } from "~/components/reviews/reviews-page";
import {
	getMarketingBundle,
	getReviewsFromBundle,
} from "~/lib/bd-bundle.server";
import { getCustomerSession } from "~/lib/bd-portal.server";
import { getBd, isServiceSuspended } from "~/lib/bd.server";

export const meta: MetaFunction = () => [{ title: "Reviews — Your Business" }];

export const links: LinksFunction = () => [
	{ rel: "stylesheet", href: reviewStyles },
];

/**
 * The business's reviews: the rating with a bar per star, a platform filter
 * (`?source=`), each review with its photos, Verified and a link to it on
 * Google or Yelp, "Show more" (`?shown=`), and writing one, which posts to
 * `/api/reviews/write`. The rules are `components/reviews/reviews.ts`, the
 * same in every BD starter.
 */
export async function loader({ request }: LoaderFunctionArgs) {
	const bundle = getMarketingBundle();
	const suspended = await bundle.then(
		() => false,
		(err: unknown) => isServiceSuspended(err),
	);
	if (suspended) return { suspended: true as const };
	const bd = getBd();
	const data = await loadReviewsPage({
		params: new URL(request.url).searchParams,
		list: bd ? (query) => bd.reviews.list(query) : null,
		totals: bundle.then(getReviewsFromBundle),
		signedIn: getCustomerSession(request).then((s) => s !== null),
	});
	return { suspended: false as const, data };
}

/** The writer's `send`: the review as JSON to the write route. */
async function sendReview(review: ReviewToSend): Promise<ReviewSendResult> {
	try {
		const res = await fetch("/api/reviews/write", {
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

export default function ReviewsPage() {
	const page = useLoaderData<typeof loader>();

	return (
		<>
			<SiteHeader />
			<main className="bd-page">
				{page.suspended ? (
					<>
						<h1 className="bd-section__title">Reviews</h1>
						<p className="bd-empty">
							Temporarily unavailable. Please check back soon.
						</p>
					</>
				) : (
					<ReviewsView
						data={page.data}
						writer={
							<ReviewWriter
								send={sendReview}
								signedIn={page.data.signedIn}
								signInHref="/my-account?next=%2Freviews"
							/>
						}
					/>
				)}
			</main>
		</>
	);
}

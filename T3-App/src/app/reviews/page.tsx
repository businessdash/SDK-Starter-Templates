import type { Metadata } from "next";

import { writeReviewAction } from "@/app/_actions/review";
import { BdFooter } from "@/app/_components/bd/Footer";
import { BdHeader } from "@/app/_components/bd/Header";
import { ReviewsView } from "@/app/_components/bd/reviews/ReviewsView";
import { ReviewWriter } from "@/app/_components/bd/reviews/ReviewWriter";
import { loadReviewsPage } from "@/app/_components/bd/reviews/reviews-page";
import { getBd, getBdBundle, getReviewsFromBundle } from "@/server/lib/bd";
import { getCustomerSession } from "@/server/lib/bd-portal";

export const dynamic = "force-dynamic";
export const metadata: Metadata = {
	title: "Reviews",
	description: "What customers say.",
};

type Props = {
	searchParams: Promise<Record<string, string | string[] | undefined>>;
};

/**
 * The business's reviews: the rating with a bar per star, a platform filter
 * (`?source=`), each review with its photos, Verified and a link to it on
 * Google or Yelp, "Show more" (`?shown=`), and writing one, which goes
 * through `writeReviewAction`. The rules are
 * `_components/bd/reviews/reviews.ts`, the same in every BD starter.
 */
export default async function ReviewsPage({ searchParams }: Props) {
	const query = await searchParams;
	const params = new URLSearchParams();
	for (const key of ["source", "shown"]) {
		const value = query[key];
		if (typeof value === "string") params.set(key, value);
	}
	const bd = getBd();
	const data = await loadReviewsPage({
		params,
		list: bd ? (q) => bd.reviews.list(q) : null,
		totals: getBdBundle("home").then(getReviewsFromBundle),
		signedIn: getCustomerSession().then((s) => s !== null),
	});

	return (
		<>
			<BdHeader />
			<main className="bd-section bd-section--narrow">
				<ReviewsView
					data={data}
					writer={
						<ReviewWriter
							send={writeReviewAction}
							signedIn={data.signedIn}
							signInHref="/my-account?next=%2Freviews"
						/>
					}
				/>
			</main>
			<BdFooter />
		</>
	);
}

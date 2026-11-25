import { Link } from "@builder.io/qwik-city";

import { type ReviewSource, sourceLabel } from "../../../lib/shop/reviews";

/** All, then a link per platform (Google, Yelp…), when reviews come from more than one. */
export function ReviewFilter({ sources, source }: { sources: ReviewSource[]; source: ReviewSource | null | undefined }) {
	if (sources.length <= 1) return null;
	return (
		<nav aria-label="Platform">
			<ul class="reviews-filter">
				<li>
					<Link href="/reviews" aria-current={source ? "false" : "true"}>
						All
					</Link>
				</li>
				{sources.map((s) => (
					<li key={s}>
						<Link href={`/reviews?source=${s}`} aria-current={source === s ? "true" : "false"}>
							{sourceLabel(s)}
						</Link>
					</li>
				))}
			</ul>
		</nav>
	);
}

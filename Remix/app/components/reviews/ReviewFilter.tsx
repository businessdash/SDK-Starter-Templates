import { BdLink } from "../bd-link";
import { type ReviewSource, sourceLabel } from "./reviews";

/** All / Google / Yelp / Other: a link per platform the reviews come from. */
export function ReviewFilter({
	sources,
	source,
}: {
	sources: ReviewSource[];
	/** The platform shown, or null for all. */
	source: ReviewSource | null;
}) {
	if (sources.length <= 1) return null;
	return (
		<nav aria-label="Platform">
			<ul className="reviews-filter">
				<li>
					<BdLink aria-current={source ? "false" : "true"} href="/reviews">
						All
					</BdLink>
				</li>
				{sources.map((s) => (
					<li key={s}>
						<BdLink
							aria-current={source === s ? "true" : "false"}
							href={`/reviews?source=${s}`}
						>
							{sourceLabel(s)}
						</BdLink>
					</li>
				))}
			</ul>
		</nav>
	);
}

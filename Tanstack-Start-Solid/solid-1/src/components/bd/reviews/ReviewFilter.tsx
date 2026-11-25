import { For, Show } from "solid-js";

import { type ReviewSource, sourceLabel } from "../../../lib/shop/reviews";

/**
 * All, then a link per platform (?source=), when there's more than one.
 * Plain links, not <Link>: <Link> sets aria-current itself, to "page"
 * whenever its search partly matches, so "All" would count as current on
 * every platform.
 */
export function ReviewFilter(props: {
	sources: ReviewSource[];
	source: ReviewSource | null | undefined;
}) {
	return (
		<Show when={props.sources.length > 1}>
			<nav aria-label="Platform">
				<ul class="reviews-filter">
					<li>
						<a href="/reviews" aria-current={props.source ? "false" : "true"}>
							All
						</a>
					</li>
					<For each={props.sources}>
						{(source) => (
							<li>
								<a
									href={`/reviews?source=${source}`}
									aria-current={props.source === source ? "true" : "false"}
								>
									{sourceLabel(source)}
								</a>
							</li>
						)}
					</For>
				</ul>
			</nav>
		</Show>
	);
}

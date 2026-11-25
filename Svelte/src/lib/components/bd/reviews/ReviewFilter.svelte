<script lang="ts">
	/** All, then each platform the reviews come from (Google, Yelp…); shown when there's more than one. */
	import { sourceLabel, type ReviewSource } from '#lib/bd/reviews.ts';

	let {
		sources,
		selected = null,
		reviewsHref = '/reviews'
	}: { sources: ReviewSource[]; selected?: string | null; reviewsHref?: string } = $props();
</script>

{#if sources.length > 1}
	<nav aria-label="Platform">
		<ul class="reviews-filter">
			<li><a href={reviewsHref} aria-current={selected ? 'false' : 'true'}>All</a></li>
			{#each sources as source (source)}
				<li>
					<a
						href={`${reviewsHref}?source=${source}`}
						aria-current={selected === source ? 'true' : 'false'}>{sourceLabel(source)}</a
					>
				</li>
			{/each}
		</ul>
	</nav>
{/if}

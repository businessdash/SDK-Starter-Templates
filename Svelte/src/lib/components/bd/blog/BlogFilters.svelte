<!-- [bd-file:blog] -->
<script lang="ts">
	/**
	 * All, each category, then each tag, as links. `href(kind, value)` builds
	 * the link for a filter (null for none); the chosen ones are marked.
	 */
	import type { BlogCategory } from '@businessdash/sdk/contracts';

	let {
		categories,
		tags,
		category = null,
		tag = null,
		href
	}: {
		categories: BlogCategory[];
		tags: string[];
		category?: string | null;
		tag?: string | null;
		href: (kind: 'category' | 'tag', value: string | null) => string;
	} = $props();
</script>

{#if categories.length > 0 || tags.length > 0}
	<nav class="blog-filters" aria-label="Blog topics">
		{#if categories.length > 0}
			<ul>
				<li><a href={href('category', null)} aria-current={!category}>All</a></li>
				{#each categories as c (c.id)}
					<li>
						<a href={href('category', c.id)} aria-current={category === c.id}>
							{c.name}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
		{#if tags.length > 0}
			<ul class="blog-filters__tags">
				{#each tags as t (t)}
					<li>
						<a href={href('tag', tag === t ? null : t)} aria-current={tag === t}>
							#{t}
						</a>
					</li>
				{/each}
			</ul>
		{/if}
	</nav>
{/if}

<style>
	.blog-filters {
		display: grid;
		gap: 0.75rem;
		margin-bottom: 2rem;
	}
	.blog-filters ul {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 0;
		padding: 0;
		list-style: none;
	}
	.blog-filters a {
		display: inline-block;
		padding: 0.35rem 0.85rem;
		border: 1px solid var(--border-strong);
		border-radius: 9999px;
		color: var(--title);
		font-size: 0.88rem;
	}
	.blog-filters__tags a {
		border-style: dashed;
		color: var(--text-muted);
	}
	.blog-filters a[aria-current='true'] {
		border-color: var(--accent);
		background: var(--accent-bg);
		color: var(--accent);
	}
</style>

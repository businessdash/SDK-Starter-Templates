<!-- [bd-file:blog] -->
<script lang="ts">
	/** The post's tags, each linking to the posts with it. */
	let { tags, blogHref = '/blog' }: { tags: string[]; blogHref?: string } = $props();
</script>

{#if tags.length > 0}
	<ul class="post__tags">
		{#each tags as tag (tag)}
			<li><a href={`${blogHref}?tag=${encodeURIComponent(tag)}`}>#{tag}</a></li>
		{/each}
	</ul>
{/if}

<style>
	.post__tags {
		display: flex;
		flex-wrap: wrap;
		gap: 0.5rem;
		margin: 2rem 0 0;
		padding: 0;
		list-style: none;
	}
	.post__tags a {
		color: var(--text-muted);
		font-size: 0.88rem;
	}
</style>

<script lang="ts">
	type BlogPost = {
		id: string;
		slug: string;
		title: string;
		excerpt?: string | null;
		publishedAt?: string | null;
	};

	let { posts }: { posts: BlogPost[] } = $props();

	function formatDate(iso: string | null | undefined): string {
		if (!iso) return '';
		const date = new Date(iso);
		if (Number.isNaN(date.getTime())) return '';
		return date.toLocaleDateString(undefined, {
			year: 'numeric',
			month: 'short',
			day: 'numeric',
		});
	}
</script>

<section class="bd-section" id="blog">
	<div class="bd-section__lead">
		<span class="bd-section__eyebrow">Latest</span>
		<h2 class="bd-section__title">From the blog</h2>
		<p class="bd-section__sub">
			Tips, customer stories, and what we're working on this month.
		</p>
	</div>
	{#if posts.length === 0}
		<div class="bd-empty">
			No blog posts published yet. Add one in BD and it'll appear here.
		</div>
	{:else}
		<div class="bd-grid-3">
			{#each posts as post (post.id)}
				<a class="bd-card blog-card" href={`/blog/${post.slug}`}>
					<span class="blog-card__meta">{formatDate(post.publishedAt)}</span>
					<h3>{post.title}</h3>
					{#if post.excerpt}<p>{post.excerpt}</p>{/if}
				</a>
			{/each}
		</div>
	{/if}
</section>

<!-- [bd-file:blog] -->
<script lang="ts">
	/** The post's call to action, when it has one. */
	import type { BlogPublicPost } from '@businessdash/sdk/contracts';

	let { post }: { post: Pick<BlogPublicPost, 'ctaLabel' | 'ctaHref' | 'ctaDescription'> } =
		$props();
</script>

{#if post.ctaHref && post.ctaLabel}
	<aside class="bd-card post__cta">
		{#if post.ctaDescription}<p>{post.ctaDescription}</p>{/if}
		<a class="bd-btn" href={post.ctaHref}>{post.ctaLabel}</a>
	</aside>
{/if}

<style>
	.post__cta {
		display: grid;
		gap: 0.75rem;
		justify-items: start;
		margin-top: 2rem;
		padding: 1.5rem;
	}
	.post__cta p {
		margin: 0;
	}
</style>

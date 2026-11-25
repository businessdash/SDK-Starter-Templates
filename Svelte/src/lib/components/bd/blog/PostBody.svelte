<!-- [bd-file:blog] -->
<script lang="ts">
	/** The post's body. `html` must already be safe: the loader rebuilds it from an allowlist (`safePostHtml`, #lib/bd/blog.ts). */
	let { html }: { html: string } = $props();
</script>

<div class="post__body">{@html html}</div>

<style>
	.post__body {
		margin-top: 2rem;
		color: var(--text);
		font-size: 1.08rem;
		line-height: 1.75;
		overflow-wrap: anywhere;
	}
	.post__body :global(h2),
	.post__body :global(h3) {
		margin: 2rem 0 0.75rem;
		color: var(--title);
		line-height: 1.25;
	}
	.post__body :global(img) {
		max-width: 100%;
		height: auto;
		border-radius: 0.75rem;
	}
	.post__body :global(blockquote) {
		margin: 1.5rem 0;
		padding-left: 1rem;
		border-left: 3px solid var(--accent);
		color: var(--subtitle);
	}
	.post__body :global(pre) {
		overflow-x: auto;
		padding: 1rem;
		border-radius: 0.6rem;
		background: var(--bg-soft);
		font-family: var(--mono);
		font-size: 0.9rem;
	}
	.post__body :global(table) {
		display: block;
		overflow-x: auto;
		border-collapse: collapse;
	}
	.post__body :global(th),
	.post__body :global(td) {
		padding: 0.5rem 0.75rem;
		border: 1px solid var(--border);
	}
</style>

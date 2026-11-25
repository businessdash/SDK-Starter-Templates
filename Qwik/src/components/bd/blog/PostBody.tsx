// [bd-file:blog]
/** The post's text. `html` must come from safePostHtml (src/lib/shop/blog.ts), which rebuilds it from an allowlist. */
export function PostBody({ html }: { html: string }) {
	return <div class="post__body" dangerouslySetInnerHTML={html} />;
}

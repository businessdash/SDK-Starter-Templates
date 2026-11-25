// [bd-file:blog]
/**
 * The post's HTML, as the server rebuilt it from an allowlist (safePostHtml,
 * src/lib/shop/blog.ts), so it carries no script.
 */
export function PostBody(props: { html: string }) {
	return <div class="post__body" innerHTML={props.html} />;
}

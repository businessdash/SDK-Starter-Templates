// [bd-file:blog]
/**
 * The post itself. `html` must already be rebuilt by `safePostHtml` (see
 * ./blog), which keeps only an allowlist of tags and attributes.
 */
export function PostBody({ html }: { html: string }) {
	return (
		<div
			className="post__body"
			// biome-ignore lint/security/noDangerouslySetInnerHtml: rebuilt from an allowlist on the server (see ./blog)
			dangerouslySetInnerHTML={{ __html: html }}
		/>
	);
}

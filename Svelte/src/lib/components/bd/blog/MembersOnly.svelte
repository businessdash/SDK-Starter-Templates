<!-- [bd-file:blog] -->
<script lang="ts">
	/** In place of a members-only post's body: sign in to read it. */
	let { signInHref }: { signInHref: string } = $props();
</script>

<div class="bd-empty">
	This post is for members.
	<p><a class="bd-btn" href={signInHref}>Sign in to read it</a></p>
</div>

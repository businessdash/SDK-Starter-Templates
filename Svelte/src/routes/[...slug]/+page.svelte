<script lang="ts">
	import type { PageData } from './$types';

	let { data }: { data: PageData } = $props();
</script>

<svelte:head>
	<title>{data.title}</title>
</svelte:head>

<!--
	`html` is sanitised server-side when the org saves it, and the title and
	logo URL are escaped by `renderLegalPageHtml`. Style it via the
	`data-bd-legal-*` hooks it emits — the markup ships unstyled so it
	inherits your site rather than fighting it.
-->
<main class="bd-section bd-section--narrow">
	{@html data.html}
</main>

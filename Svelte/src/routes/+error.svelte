<script lang="ts">
	import { page } from '$app/state';

	/**
	 * The error page, which is also the 404.
	 *
	 * Deliberately static — no BusinessDash call, no data fetch, nothing that
	 * can fail. This renders while something else is broken, so it must not
	 * depend on the thing that is broken.
	 */
</script>

<svelte:head>
	<title>{page.status === 404 ? 'Page not found' : 'Something went wrong'}</title>
</svelte:head>

<main class="biab-section biab-section--narrow">
	<div class="biab-section__lead">
		<span class="biab-section__eyebrow">{page.status}</span>
		<h1 class="biab-section__title">
			{page.status === 404 ? "We couldn't find that page" : 'Something went wrong'}
		</h1>
		<p class="biab-section__sub">
			{page.status === 404
				? 'The link may be out of date, or the page may have moved.'
				: 'Please try again in a moment.'}
		</p>
	</div>
	<p><a href="/">Back to the homepage</a></p>
</main>

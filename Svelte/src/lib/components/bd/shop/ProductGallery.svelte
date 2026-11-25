<!-- [bd-file:store] -->
<script lang="ts">
	/**
	 * The photos for what's chosen: the one shown (`photo`, bindable), ‹ and ›
	 * to step through them, and a thumbnail for each.
	 */
	let {
		photos,
		name,
		photo = $bindable(0)
	}: { photos: string[]; name: string; photo?: number } = $props();
</script>

<div class="gallery">
	<div class="gallery__main">
		{#if photos[photo]}
			<img src={photos[photo]} alt={name} referrerpolicy="no-referrer" />
		{:else}
			<div class="gallery__placeholder">No photo yet</div>
		{/if}
		{#if photos.length > 1}
			<button
				type="button"
				class="gallery__step gallery__step--prev"
				aria-label="Previous photo"
				onclick={() => (photo = (photo - 1 + photos.length) % photos.length)}>‹</button
			>
			<button
				type="button"
				class="gallery__step gallery__step--next"
				aria-label="Next photo"
				onclick={() => (photo = (photo + 1) % photos.length)}>›</button
			>
		{/if}
	</div>
	{#if photos.length > 1}
		<div class="gallery__thumbs">
			{#each photos as src, i (src + i)}
				<button
					type="button"
					class="gallery__thumb"
					class:gallery__thumb--on={i === photo}
					aria-label={`Photo ${i + 1} of ${photos.length}`}
					aria-current={i === photo}
					onclick={() => (photo = i)}
				>
					<img {src} alt="" loading="lazy" referrerpolicy="no-referrer" />
				</button>
			{/each}
		</div>
	{/if}
</div>

<style>
	@media (min-width: 860px) {
		.gallery {
			position: sticky;
			top: 5.5rem;
		}
	}
	.gallery__main {
		position: relative;
		overflow: hidden;
		border-radius: 1rem;
		background: var(--bg-soft);
		aspect-ratio: 1;
	}
	.gallery__main img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
	.gallery__placeholder {
		display: grid;
		place-items: center;
		height: 100%;
		color: var(--text-muted);
	}
	.gallery__step {
		position: absolute;
		top: 50%;
		translate: 0 -50%;
		width: 2.5rem;
		height: 2.5rem;
		border: none;
		border-radius: 9999px;
		background: var(--glass-card);
		color: var(--title);
		font-size: 1.4rem;
		cursor: pointer;
	}
	.gallery__step--prev {
		left: 0.75rem;
	}
	.gallery__step--next {
		right: 0.75rem;
	}
	.gallery__thumbs {
		display: flex;
		gap: 0.5rem;
		margin-top: 0.75rem;
		overflow-x: auto;
	}
	.gallery__thumb {
		flex: 0 0 4.5rem;
		height: 4.5rem;
		padding: 0;
		border: 2px solid transparent;
		border-radius: 0.6rem;
		overflow: hidden;
		background: var(--bg-soft);
		cursor: pointer;
	}
	.gallery__thumb--on {
		border-color: var(--accent);
	}
	.gallery__thumb img {
		width: 100%;
		height: 100%;
		object-fit: cover;
	}
</style>

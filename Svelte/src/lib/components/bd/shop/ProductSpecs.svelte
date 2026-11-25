<!-- [bd-file:store] -->
<script lang="ts">
	/** Details: the feature list, then a table per spec group. */
	import type { SpecGroup } from '#lib/bd/shop.ts';

	let { features, specs }: { features: string[]; specs: SpecGroup[] } = $props();
</script>

{#if features.length > 0 || specs.length > 0}
	<section class="product-section" id="specs">
		<h2 class="product-section__title">Details</h2>
		{#if features.length > 0}
			<ul class="features">
				{#each features as feature (feature)}<li>{feature}</li>{/each}
			</ul>
		{/if}
		{#each specs as group (group.name)}
			<table class="specs">
				<caption>{group.name}</caption>
				<tbody>
					{#each group.rows as row (row.label)}
						<tr><th scope="row">{row.label}</th><td>{row.value}</td></tr>
					{/each}
				</tbody>
			</table>
		{/each}
	</section>
{/if}

<style>
	.product-section {
		margin-top: 3rem;
	}
	.product-section__title {
		font-size: 1.4rem;
		margin-bottom: 1.25rem;
	}
	.features {
		display: grid;
		gap: 0.4rem;
		margin: 0 0 1.5rem;
		padding-left: 1.2rem;
		color: var(--text);
	}
	.specs {
		width: 100%;
		max-width: 44rem;
		margin-bottom: 1.5rem;
		border-collapse: collapse;
		font-size: 0.92rem;
	}
	.specs caption {
		padding-bottom: 0.5rem;
		text-align: left;
		color: var(--title);
		font-weight: 700;
	}
	.specs th,
	.specs td {
		padding: 0.6rem 0.75rem;
		border-top: 1px solid var(--border);
		text-align: left;
		vertical-align: top;
	}
	.specs th {
		width: 40%;
		color: var(--text-muted);
		font-weight: 500;
	}
</style>

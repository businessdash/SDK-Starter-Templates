<script lang="ts">
	import { enhance } from '$app/forms';
	import Header from '$lib/components/bd/Header.svelte';
	import Footer from '$lib/components/bd/Footer.svelte';
	import type { ActionData, PageData } from './$types';

	let { data, form }: { data: PageData; form: ActionData } = $props();

	let submitting = $state(false);
</script>

<svelte:head><title>Todos</title></svelte:head>

<Header />

<main class="bd-section bd-section--narrow">
	<div class="bd-section__lead">
		<span class="bd-section__eyebrow">Custom collections</span>
		<h1 class="bd-section__title">Todos</h1>
		<p class="bd-section__sub">
			A relational custom-collections demo — todos and their images live in your BD custom
			database.
		</p>
	</div>

	<form
		class="bd-card todo-form"
		method="POST"
		use:enhance={() => {
			submitting = true;
			return async ({ update }) => {
				submitting = false;
				await update();
			};
		}}
	>
		<label class="todo-form__label" for="todo-title">Title</label>
		<input
			id="todo-title"
			name="title"
			class="todo-form__input"
			placeholder="What needs doing?"
			required
		/>
		<label class="todo-form__label" for="todo-notes">Notes (optional)</label>
		<textarea id="todo-notes" name="notes" class="todo-form__input" rows="2"></textarea>
		<button class="todo-form__btn" disabled={submitting} type="submit">
			{submitting ? 'Adding…' : 'Add todo'}
		</button>
		{#if form && 'message' in form && form.message}
			<p class="todo-form__msg todo-form__msg--error">{form.message}</p>
		{:else if form?.added}
			<p class="todo-form__msg">Added.</p>
		{/if}
	</form>

	{#if !data.available}
		<div class="bd-empty">
			{data.reason ??
				"Todos aren't readable yet — sync + promote bd.data-model.config.ts and check your key's scopes."}
		</div>
	{:else if data.todos.length === 0}
		<div class="bd-empty">No todos yet — add the first one.</div>
	{:else}
		<ul class="todo-list">
			{#each data.todos as todo (todo.id)}
				<li class="bd-card todo-item">
					<div class="todo-item__head">
						<span class="todo-item__mark">{todo.done ? '✓' : '○'}</span>
						<strong class="todo-item__title" class:todo-item__title--done={todo.done}>
							{todo.title}
						</strong>
					</div>
					{#if todo.notes}<p class="todo-item__notes">{todo.notes}</p>{/if}
					{#if todo.images.length}
						<div class="todo-item__images">
							{#each todo.images as image, i (i)}
								<figure class="todo-item__figure">
									<img
										class="todo-item__img"
										src={image.url}
										alt={image.alt ?? image.label ?? todo.title}
										loading="lazy"
									/>
									{#if image.label}<figcaption>{image.label}</figcaption>{/if}
								</figure>
							{/each}
						</div>
					{/if}
				</li>
			{/each}
		</ul>
	{/if}
</main>

<Footer />

<style>
	.todo-form {
		display: flex;
		flex-direction: column;
		gap: 0.5rem;
		padding: 1.25rem;
		margin-bottom: 1.5rem;
	}
	.todo-form__label {
		font-weight: 600;
		font-size: 0.875rem;
	}
	.todo-form__input {
		border: 1px solid var(--bd-border, #d4d4d8);
		border-radius: 0.5rem;
		padding: 0.5rem 0.75rem;
		font: inherit;
	}
	.todo-form__btn {
		align-self: flex-start;
		margin-top: 0.5rem;
		border: none;
		border-radius: 0.5rem;
		padding: 0.55rem 1.1rem;
		background: var(--bd-accent, #047857);
		color: #fff;
		font-weight: 600;
		cursor: pointer;
	}
	.todo-form__btn:disabled {
		opacity: 0.6;
		cursor: wait;
	}
	.todo-form__msg {
		font-size: 0.875rem;
	}
	.todo-form__msg--error {
		color: #b91c1c;
	}
	.todo-list {
		list-style: none;
		margin: 0;
		padding: 0;
		display: flex;
		flex-direction: column;
		gap: 1rem;
	}
	.todo-item {
		padding: 1.25rem;
	}
	.todo-item__head {
		display: flex;
		align-items: baseline;
		gap: 0.5rem;
	}
	.todo-item__title--done {
		text-decoration: line-through;
		opacity: 0.6;
	}
	.todo-item__notes {
		margin: 0.5rem 0 0;
		color: var(--bd-muted, #52525b);
	}
	.todo-item__images {
		display: flex;
		flex-wrap: wrap;
		gap: 0.75rem;
		margin-top: 0.75rem;
	}
	.todo-item__figure {
		margin: 0;
	}
	.todo-item__img {
		width: 7rem;
		height: 7rem;
		object-fit: cover;
		border-radius: 0.5rem;
	}
</style>

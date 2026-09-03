<script setup lang="ts">
import BdHeader from "~/components/bd/BdHeader.vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import type { TodosPayload } from "../../server/api/bd/todos.get";

// Slug of the generated create form — see TODO_FORM_SLUG in
// `bd.data-model.config.ts`. Kept as a local literal so the schema config
// (which imports the SDK's schema pipeline) never enters the client bundle.
const TODO_FORM_SLUG = "todo-form";

/**
 * Todos — the relational custom-collections demo (`bd.data-model.config.ts`).
 *
 * READ: `/api/bd/todos` lists both collections via the SDK's
 * `dataModel.listRecords({ object })` and joins images to todos through the
 * `todo` RELATION field.
 * WRITE: submitting the generated "Todo Form" (slug `todo-form`) through the
 * existing `/api/bd/forms/[slug]` proxy — forms are the SDK's documented
 * create path for custom collections; there is no direct row-write surface.
 */
const { data, refresh } = await useFetch<TodosPayload>("/api/bd/todos");

const title = ref("");
const notes = ref("");
const submitting = ref(false);
const message = ref<string | null>(null);
const failed = ref(false);

async function addTodo() {
	if (!title.value.trim() || submitting.value) return;
	submitting.value = true;
	message.value = null;
	failed.value = false;
	try {
		const result = await $fetch<{ ok: boolean; message?: string }>(
			`/api/bd/forms/${TODO_FORM_SLUG}`,
			{
				method: "POST",
				body: {
					// Keyed by each field's output key — `validateFormSubmission`
					// accepts output keys (preferred) or legacy field ids.
					data: { title: title.value.trim(), notes: notes.value.trim() || undefined },
				},
			},
		);
		if (result.ok === false) {
			failed.value = true;
			message.value = result.message ?? "Couldn't add that todo.";
		} else {
			title.value = "";
			notes.value = "";
			message.value = "Added.";
			await refresh();
		}
	} catch (err) {
		failed.value = true;
		message.value =
			err instanceof Error
				? err.message
				: "Couldn't add that todo — is the generated \"Todo Form\" Live?";
	} finally {
		submitting.value = false;
	}
}

useHead({ title: "Todos — Your Business" });
</script>

<template>
	<div>
		<BdHeader />
		<main>
			<section class="bd-section bd-section--narrow">
				<div class="bd-section__lead">
					<span class="bd-section__eyebrow">Custom collections</span>
					<h1 class="bd-section__title">Todos</h1>
					<p class="bd-section__sub">
						A relational custom-collections demo — todos and their images live
						in your BD custom database.
					</p>
				</div>

				<form class="bd-card todo-form" @submit.prevent="addTodo">
					<label class="todo-form__label" for="todo-title">Title</label>
					<input
						id="todo-title"
						v-model="title"
						class="todo-form__input"
						placeholder="What needs doing?"
						required
					/>
					<label class="todo-form__label" for="todo-notes">Notes (optional)</label>
					<textarea
						id="todo-notes"
						v-model="notes"
						class="todo-form__input"
						rows="2"
					></textarea>
					<button class="todo-form__btn" :disabled="submitting" type="submit">
						{{ submitting ? "Adding…" : "Add todo" }}
					</button>
					<p v-if="message" :class="failed ? 'todo-form__msg todo-form__msg--error' : 'todo-form__msg'">
						{{ message }}
					</p>
				</form>

				<div v-if="!data || !data.available" class="bd-empty">
					{{
						data?.reason ??
						"Todos aren't readable yet — sync + promote bd.data-model.config.ts and check your key's scopes."
					}}
				</div>
				<div v-else-if="data.todos.length === 0" class="bd-empty">
					No todos yet — add the first one.
				</div>
				<ul v-else class="todo-list">
					<li v-for="todo in data.todos" :key="todo.id" class="bd-card todo-item">
						<div class="todo-item__head">
							<span class="todo-item__mark">{{ todo.done ? "✓" : "○" }}</span>
							<strong :class="todo.done ? 'todo-item__title todo-item__title--done' : 'todo-item__title'">
								{{ todo.title }}
							</strong>
						</div>
						<p v-if="todo.notes" class="todo-item__notes">{{ todo.notes }}</p>
						<div v-if="todo.images.length" class="todo-item__images">
							<figure v-for="(image, i) in todo.images" :key="i" class="todo-item__figure">
								<img
									:alt="image.alt ?? image.label ?? todo.title"
									class="todo-item__img"
									loading="lazy"
									:src="image.url"
								/>
								<figcaption v-if="image.label">{{ image.label }}</figcaption>
							</figure>
						</div>
					</li>
				</ul>
			</section>
		</main>
		<BdFooter />
	</div>
</template>

<style scoped>
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

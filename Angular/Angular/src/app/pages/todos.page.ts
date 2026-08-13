import { ChangeDetectionStrategy, Component, OnInit, signal } from "@angular/core";
import { FormControl, FormGroup, ReactiveFormsModule, Validators } from "@angular/forms";
import { RouterLink } from "@angular/router";
import { biabApi, type TodosPayload } from "../lib/biab-api.client";

/**
 * Standalone /todos route — the relational custom-collections demo
 * (`biab.data-model.config.ts`: `todos` + `todoImages`, whose `todo` field
 * is a RELATION back to `todos`).
 *
 * READ: `GET /api/biab/todos` lists both collections server-side via the
 * SDK's `dataModel.listRecords({ object })` and joins images to todos
 * through the `todo` RELATION field.
 * WRITE: `POST /api/biab/todos` submits the generated "Todo Form" (slug
 * `todo-form`) via `biab.forms.submit` — forms are the SDK's documented
 * create path for custom collections; there is no direct row-write surface.
 */
@Component({
	selector: "biab-todos-page",
	changeDetection: ChangeDetectionStrategy.OnPush,
	imports: [ReactiveFormsModule, RouterLink],
	template: `
		<section class="section">
			<h1 class="section__title">Todos</h1>
			<p class="muted">
				A relational custom-collections demo — todos and their images live in
				your BIAB custom database.
			</p>

			<form class="card todo-form" [formGroup]="todoForm" (ngSubmit)="addTodo()">
				<label for="todo-title"><strong>Title</strong></label>
				<input
					id="todo-title"
					formControlName="title"
					placeholder="What needs doing?"
				/>
				<label for="todo-notes"><strong>Notes (optional)</strong></label>
				<textarea id="todo-notes" formControlName="notes" rows="2"></textarea>
				<button
					class="btn btn--primary"
					[disabled]="submitting() || todoForm.invalid"
					type="submit"
				>
					{{ submitting() ? "Adding…" : "Add todo" }}
				</button>
				@if (message(); as msg) {
					<p class="muted" [class.todo-form__error]="failed()">{{ msg }}</p>
				}
			</form>

			@if (!payload()) {
				<p class="muted">Loading…</p>
			} @else if (!payload()!.available) {
				<p class="muted">
					{{
						payload()!.reason ??
							"Todos aren't readable yet — sync + promote biab.data-model.config.ts and check your key's scopes."
					}}
				</p>
			} @else if (payload()!.todos.length === 0) {
				<p class="muted">No todos yet — add the first one.</p>
			} @else {
				<ul class="todo-list">
					@for (todo of payload()!.todos; track todo.id) {
						<li class="card todo-item">
							<div class="todo-item__head">
								<span>{{ todo.done ? "✓" : "○" }}</span>
								<strong [class.todo-item__title--done]="todo.done">{{ todo.title }}</strong>
							</div>
							@if (todo.notes) {
								<p class="muted">{{ todo.notes }}</p>
							}
							@if (todo.images.length) {
								<div class="todo-item__images">
									@for (image of todo.images; track image.url) {
										<figure class="todo-item__figure">
											<img
												[alt]="image.alt ?? image.label ?? todo.title"
												[src]="image.url"
												class="todo-item__img"
												loading="lazy"
											/>
											@if (image.label) {
												<figcaption>{{ image.label }}</figcaption>
											}
										</figure>
									}
								</div>
							}
						</li>
					}
				</ul>
			}
			<p class="store-links"><a routerLink="/">Back home</a></p>
		</section>
	`,
	styles: `
		.todo-form {
			display: flex;
			flex-direction: column;
			gap: 0.5rem;
			padding: 1.25rem;
			margin-bottom: 1.5rem;
		}
		.todo-form__error {
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
	`,
})
export class TodosPage implements OnInit {
	readonly payload = signal<TodosPayload | null>(null);
	readonly submitting = signal(false);
	readonly message = signal<string | null>(null);
	readonly failed = signal(false);

	readonly todoForm = new FormGroup({
		title: new FormControl("", { nonNullable: true, validators: [Validators.required] }),
		notes: new FormControl("", { nonNullable: true }),
	});

	ngOnInit() {
		void this.load();
	}

	private async load() {
		this.payload.set(
			(await biabApi.todos()) ?? {
				available: false,
				reason: "Couldn't read todos.",
				todos: [],
			},
		);
	}

	async addTodo() {
		const title = this.todoForm.controls.title.value.trim();
		if (!title || this.submitting()) return;
		this.submitting.set(true);
		this.message.set(null);
		this.failed.set(false);
		const notes = this.todoForm.controls.notes.value.trim();
		const result = await biabApi.createTodo({
			title,
			...(notes ? { notes } : {}),
		});
		if (result?.ok) {
			this.todoForm.reset();
			this.message.set("Added.");
			await this.load();
		} else {
			this.failed.set(true);
			this.message.set(
				result?.message ??
					'Couldn\'t add that todo — is the generated "Todo Form" Live?',
			);
		}
		this.submitting.set(false);
	}
}

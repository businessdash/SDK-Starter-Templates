import { createFileRoute, useRouter } from "@tanstack/solid-router";
import { For, Show } from "solid-js";

import {
	BiabForm,
	type BiabClient,
	type FormSubmitResult,
} from "@businessdash/sdk/solid";

import { getTodosData, submitTodoForm } from "../lib/biab-server-fns";

/**
 * `/todos` — the relational custom-collections demo. Two collections declared
 * in `biab.data-model.config.ts` — `todos`, and `todoImages` pointing at a
 * todo via a required RELATION field. This page:
 *
 *   - LISTS todos (with any images joined on) in the loader via
 *     `dataModel.listRecords` (join in `lib/biab-todos.ts`) — the documented
 *     read path.
 *   - CREATES a todo by submitting the generated `todo-form` through the
 *     `submitTodoForm` server fn — the documented write path (there is no
 *     direct row-write API for consumers).
 *
 * Until the model is synced + promoted (and the form set Live) the page shows
 * setup notices instead of failing.
 */
export const Route = createFileRoute("/todos")({
	component: TodosPage,
	loader: () => getTodosData(),
});

function TodosPage() {
	const data = Route.useLoaderData();
	const router = useRouter();

	// The ok-branch of the discriminated union, or null — lets `<Show>` hand
	// the narrowed accessor to its child.
	const okResult = () => {
		const r = data().result;
		return r.status === "ok" ? r : null;
	};

	// Minimal client shim — only `forms.submit` is exercised because we pass a
	// pre-fetched `schema` (same pattern as the contact form).
	const submitClient = {
		forms: {
			async submit(
				_slug: string,
				values: Record<string, unknown>,
			): Promise<FormSubmitResult> {
				try {
					return (await submitTodoForm({
						data: { values },
					})) as FormSubmitResult;
				} catch (err) {
					return {
						ok: false,
						status: 0,
						reason: "network_error",
						message:
							err instanceof Error ? err.message : "Couldn't submit the form.",
					};
				}
			},
		},
	} as unknown as BiabClient;

	return (
		<main>
			<section class="biab-section biab-section--narrow" id="todos">
				<div class="biab-section__lead">
					<span class="biab-section__eyebrow">Custom collections</span>
					<h2 class="biab-section__title">Todos</h2>
					<p class="biab-section__sub">
						Rows live in your org's custom database — two related collections (
						<code>todos</code> + <code>todoImages</code>) declared in{" "}
						<code>biab.data-model.config.ts</code>, read via{" "}
						<code>dataModel.listRecords</code>, created through the generated{" "}
						<code>todo-form</code>.
					</p>
				</div>

				<Show when={data().result.status === "unconfigured"}>
					<div class="biab-empty">
						BIAB isn't configured — set the env vars in <code>.env</code> (see{" "}
						<code>.env.example</code>) to run this demo.
					</div>
				</Show>
				<Show when={data().result.status === "unavailable"}>
					<div class="biab-empty">
						The todos model isn't readable yet. Run{" "}
						<code>pnpm sync-data-model</code>, promote it in the BIAB dashboard,
						and make sure your secret key carries the{" "}
						<code>metadata:read_records</code> scope (custom objects are a
						plan-gated surface).
					</div>
				</Show>

				<Show when={okResult()}>
					{(ok) => (
						<Show
							when={ok().todos.length > 0}
							fallback={
								<div class="biab-empty">
									No todos yet — add the first one below.
								</div>
							}
						>
							<ul
								style={{
									display: "grid",
									gap: "1rem",
									"list-style": "none",
									margin: "0",
									padding: "0",
								}}
							>
								<For each={ok().todos}>
									{(todo) => (
										<li class="biab-card">
											<div
												style={{
													"align-items": "center",
													display: "flex",
													gap: "0.5rem",
												}}
											>
												<span class="biab-badge">
													{todo.done ? "Done" : "Open"}
												</span>
												<h3 style={{ margin: "0" }}>{todo.title}</h3>
											</div>
											<Show when={todo.notes}>
												<p>{todo.notes}</p>
											</Show>
											<Show when={todo.images.length > 0}>
												<ul
													style={{
														display: "flex",
														"flex-wrap": "wrap",
														gap: "0.5rem",
														"list-style": "none",
														margin: "0.75rem 0 0",
														padding: "0",
													}}
												>
													<For each={todo.images}>
														{(image) => (
															<li>
																<img
																	alt={image.alt ?? image.label ?? todo.title}
																	height={96}
																	loading="lazy"
																	src={image.url}
																	style={{
																		"border-radius": "0.5rem",
																		"object-fit": "cover",
																	}}
																	width={96}
																/>
																<Show when={image.label}>
																	<span style={{ display: "block" }}>
																		{image.label}
																	</span>
																</Show>
															</li>
														)}
													</For>
												</ul>
											</Show>
										</li>
									)}
								</For>
							</ul>
						</Show>
					)}
				</Show>
			</section>

			<Show when={data().result.status !== "unconfigured"}>
				<section class="biab-section biab-section--narrow" id="add-todo">
					<div class="biab-section__lead">
						<h2 class="biab-section__title">Add a todo</h2>
					</div>
					<Show
						when={data().formSchema}
						fallback={
							<div class="biab-empty">
								The create form isn't live yet — promote the data model and
								activate "Todo Form" (slug <code>todo-form</code>) in the
								dashboard's Forms surface.
							</div>
						}
					>
						{(schema) => (
							<div class="biab-card">
								<BiabForm
									schema={schema()}
									client={submitClient}
									submitLabel="Add todo"
									// The row exists server-side on success — invalidate so the
									// loader re-reads.
									onSuccess={() => {
										void router.invalidate();
									}}
								/>
							</div>
						)}
					</Show>
				</section>
			</Show>
		</main>
	);
}

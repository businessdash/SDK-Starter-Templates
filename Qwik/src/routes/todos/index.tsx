import { component$ } from "@builder.io/qwik";
import {
	type DocumentHead,
	routeLoader$,
	server$,
} from "@builder.io/qwik-city";
import { BiabForm } from "@businessdash/sdk/qwik";
import type { FormSchema, FormSubmitResult } from "@businessdash/sdk/forms";

import { TODO_FORM_SLUG } from "../../../biab.data-model.config";
import { getBiab } from "../../lib/biab";
import { listTodosWithImages } from "../../lib/biab-todos";

/**
 * `/todos` — the relational custom-collections demo. Two collections declared
 * in `biab.data-model.config.ts` — `todos`, and `todoImages` pointing at a
 * todo via a required RELATION field. This page:
 *
 *   - LISTS todos (with any images joined on) in `routeLoader$` via
 *     `dataModel.listRecords` (see `src/lib/biab-todos.ts`) — the documented
 *     read path.
 *   - CREATES a todo by submitting the generated `todo-form` through a
 *     `server$` RPC — the documented write path (there is no direct
 *     row-write API for consumers).
 *
 * Until the model is synced + promoted (and the form set Live) the page shows
 * setup notices instead of failing.
 */

export const useTodosData = routeLoader$(async () => {
	const biab = getBiab();
	const [result, formSchema] = await Promise.all([
		listTodosWithImages(),
		biab
			? (biab.forms.schema(TODO_FORM_SLUG).catch(() => null) as Promise<
					FormSchema | null
				>)
			: Promise.resolve(null),
	]);
	return { result, formSchema };
});

// Server RPC — the `forms.submit` round-trip runs ONLY here, so the BIAB
// bearer key never enters the client bundle. The generated `todo-form`
// carries the `create_records` action that inserts the row server-side.
const submitTodoForm = server$(async function (
	payload: Record<string, unknown>,
): Promise<FormSubmitResult> {
	const biab = getBiab();
	if (!biab) {
		return {
			ok: false,
			status: 0,
			reason: "network_error",
			message: "BIAB is not configured (missing env).",
		};
	}
	return await biab.forms.submit(TODO_FORM_SLUG, payload, {
		source: "qwik-starter",
	});
});

export default component$(() => {
	const data = useTodosData();
	const { result, formSchema } = data.value;

	return (
		<>
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

				{result.status === "unconfigured" ? (
					<div class="biab-empty">
						BIAB isn't configured — set the env vars in <code>.env.local</code>{" "}
						(see <code>.env.example</code>) to run this demo.
					</div>
				) : result.status === "unavailable" ? (
					<div class="biab-empty">
						The todos model isn't readable yet. Run{" "}
						<code>pnpm sync-data-model</code>, promote it in the BIAB dashboard,
						and make sure your secret key carries the{" "}
						<code>metadata:read_records</code> scope (custom objects are a
						plan-gated surface).
					</div>
				) : result.todos.length === 0 ? (
					<div class="biab-empty">No todos yet — add the first one below.</div>
				) : (
					<ul
						style={{
							display: "grid",
							gap: "1rem",
							listStyle: "none",
							margin: 0,
							padding: 0,
						}}
					>
						{result.todos.map((todo) => (
							<li class="biab-card" key={todo.id}>
								<div
									style={{
										alignItems: "center",
										display: "flex",
										gap: "0.5rem",
									}}
								>
									<span class="biab-badge">{todo.done ? "Done" : "Open"}</span>
									<h3 style={{ margin: 0 }}>{todo.title}</h3>
								</div>
								{todo.notes ? <p>{todo.notes}</p> : null}
								{todo.images.length > 0 ? (
									<ul
										style={{
											display: "flex",
											flexWrap: "wrap",
											gap: "0.5rem",
											listStyle: "none",
											margin: "0.75rem 0 0",
											padding: 0,
										}}
									>
										{todo.images.map((image) => (
											<li key={image.id}>
												<img
													alt={image.alt ?? image.label ?? todo.title}
													height={96}
													loading="lazy"
													src={image.url}
													style={{
														borderRadius: "0.5rem",
														objectFit: "cover",
													}}
													width={96}
												/>
												{image.label ? (
													<span style={{ display: "block" }}>
														{image.label}
													</span>
												) : null}
											</li>
										))}
									</ul>
								) : null}
							</li>
						))}
					</ul>
				)}
			</section>

			{result.status !== "unconfigured" ? (
				<section class="biab-section biab-section--narrow" id="add-todo">
					<div class="biab-section__lead">
						<h2 class="biab-section__title">Add a todo</h2>
					</div>
					{formSchema ? (
						<BiabForm
							class="biab-card"
							schema={formSchema}
							submit$={submitTodoForm}
							submitLabel="Add todo"
							// The row exists server-side on success — reload so the loader
							// re-reads (leaving the confirmation visible for a beat first).
							onSuccess$={() => {
								setTimeout(() => window.location.reload(), 900);
							}}
						>
							<div q:slot="success" class="biab-form__success">
								<span class="biab-badge">Added</span>
								<p>Saved to your custom DB.</p>
							</div>
						</BiabForm>
					) : (
						<div class="biab-empty">
							The create form isn't live yet — promote the data model and
							activate "Todo Form" (slug <code>todo-form</code>) in the
							dashboard's Forms surface.
						</div>
					)}
				</section>
			) : null}
		</>
	);
});

export const head: DocumentHead = {
	title: "Todos — Your Business",
	meta: [
		{
			name: "description",
			content: "Relational custom-collections demo (todos + todoImages).",
		},
	],
};

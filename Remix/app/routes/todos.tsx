import type { MetaFunction } from "react-router";
import { useLoaderData, useRevalidator } from "react-router";

import { BiabForm, type BiabFormsClient } from "@businessdash/sdk/react";
import type { FormSchema, FormSubmitResult } from "@businessdash/sdk";

import { TODO_FORM_SLUG } from "../../biab.data-model.config";
import { SiteHeader } from "~/components/SiteHeader";
import { listTodosWithImages } from "~/lib/biab-todos.server";

/**
 * `/todos` — the relational custom-collections demo. Two collections declared
 * in `biab.data-model.config.ts` — `todos`, and `todoImages` pointing at a
 * todo via a required RELATION field. This page:
 *
 *   - LISTS todos (with any images joined on) in the loader via
 *     `dataModel.listRecords` — the documented read path.
 *   - CREATES a todo by submitting the generated `todo-form` through the
 *     existing `/api/biab/forms` proxy — the documented write path (there is
 *     no direct row-write API for consumers).
 *
 * Until the model is synced + promoted (and the form set Live) the page shows
 * setup notices instead of failing.
 */

export const meta: MetaFunction = () => [{ title: "Todos — Your Business" }];

export async function loader() {
	return { result: await listTodosWithImages(), formSlug: TODO_FORM_SLUG };
}

// Same-origin forms proxy — identical to the contact form's client, so the
// BIAB bearer key never reaches the browser.
const biabFormsProxy: BiabFormsClient = {
	forms: {
		async schema(slug: string): Promise<FormSchema> {
			const res = await fetch(
				`/api/biab/forms?slug=${encodeURIComponent(slug)}`,
			);
			if (!res.ok) throw new Error(`Failed to load form (${res.status}).`);
			return (await res.json()) as FormSchema;
		},
		async submit(
			slug: string,
			data: Record<string, unknown>,
			opts?: Record<string, unknown>,
		): Promise<FormSubmitResult> {
			const res = await fetch("/api/biab/forms", {
				method: "POST",
				headers: { "Content-Type": "application/json" },
				body: JSON.stringify({ slug, data, ...opts }),
			});
			return (await res.json()) as FormSubmitResult;
		},
	},
};

export default function TodosPage() {
	const { result, formSlug } = useLoaderData<typeof loader>();
	const revalidator = useRevalidator();

	return (
		<>
			<SiteHeader />
			<main>
				<section className="section">
					<h1 className="section__title">Todos</h1>
					<p className="muted">
						Rows live in your org's custom database — two related collections
						(<code>todos</code> + <code>todoImages</code>) declared in{" "}
						<code>biab.data-model.config.ts</code>, read via{" "}
						<code>dataModel.listRecords</code>, created through the generated{" "}
						<code>todo-form</code>.
					</p>

					{result.status === "unconfigured" ? (
						<p className="muted">
							BIAB isn't configured — set the env vars in <code>.env.local</code>{" "}
							(see <code>.env.example</code>) to run this demo.
						</p>
					) : result.status === "unavailable" ? (
						<p className="muted">
							The todos model isn't readable yet. Run{" "}
							<code>pnpm sync-data-model</code>, promote it in the BIAB
							dashboard, and make sure your secret key carries the{" "}
							<code>metadata:read_records</code> scope (custom objects are a
							plan-gated surface).
						</p>
					) : result.todos.length === 0 ? (
						<p className="muted">No todos yet — add the first one below.</p>
					) : (
						<ul className="post-list">
							{result.todos.map((todo) => (
								<li key={todo.id}>
									<span className="biab-badge">
										{todo.done ? "Done" : "Open"}
									</span>{" "}
									<strong>{todo.title}</strong>
									{todo.notes ? <p>{todo.notes}</p> : null}
									{todo.images.length > 0 ? (
										<ul
											style={{
												display: "flex",
												flexWrap: "wrap",
												gap: "0.5rem",
												listStyle: "none",
												padding: 0,
											}}
										>
											{todo.images.map((image) => (
												<li key={image.id}>
													<img
														alt={image.alt ?? image.label ?? todo.title}
														className="card__img"
														height={96}
														src={image.url}
														style={{ objectFit: "cover" }}
														width={96}
													/>
													{image.label ? (
														<span className="muted" style={{ display: "block" }}>
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
					<section className="section">
						<h2 className="section__title">Add a todo</h2>
						{/* The WRITE path: custom-collection rows are created by submitting
						    the model's auto-generated create form (`todo-form`) — the form
						    carries the `create_records` action that inserts the row
						    server-side. On success we revalidate so the loader re-reads. */}
						<BiabForm
							slug={formSlug}
							client={biabFormsProxy}
							submitLabel="Add todo"
							onSuccess={() => revalidator.revalidate()}
							successFallback={() => (
								<p className="muted">Added — saved to your custom DB.</p>
							)}
							errorFallback={() => (
								<p className="muted">
									The create form isn't live yet — promote the data model and
									activate "Todo Form" (slug <code>todo-form</code>) in the
									dashboard's Forms surface.
								</p>
							)}
						/>
					</section>
				) : null}
			</main>
		</>
	);
}

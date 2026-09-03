import { useState } from "react";

import { BdForm } from "@businessdash/sdk/react";

import { bd } from "../lib/bd";
import { ErrorBox, PageHead, useApi } from "./ui";

/**
 * `/todos` — the relational custom-collections demo. Two collections declared
 * in `bd.data-model.config.ts` — `todos`, and `todoImages` pointing at a
 * todo via a required RELATION field. This page:
 *
 *   - LISTS todos (with any images joined on) via `bd.todos.list()` → the
 *     Bun server's `dataModel.listRecords` join — the documented read path.
 *   - CREATES a todo by submitting the generated `todo-form` through the
 *     existing forms proxy (`client={bd}`) — the documented write path
 *     (there is no direct row-write API for consumers).
 *
 * Until the model is synced + promoted (and the form set Live) the page shows
 * setup notices instead of failing.
 */
export function Todos() {
	// Bumped on every successful create so `useApi` re-reads the list.
	const [refreshKey, setRefreshKey] = useState(0);
	const { data, error, loading } = useApi(() => bd.todos.list(), [refreshKey]);

	return (
		<main className="page">
			<PageHead
				title="Todos"
				sub="Relational custom collections — todos + todoImages, straight from your org's custom database."
			/>
			{loading ? <p className="muted">Loading…</p> : null}
			{error ? <ErrorBox error={error} /> : null}

			{data?.status === "unconfigured" ? (
				<p className="muted">
					BD isn't configured — set the env vars in <code>.env.local</code>{" "}
					(see <code>.env.example</code>) to run this demo.
				</p>
			) : null}
			{data?.status === "unavailable" ? (
				<p className="muted">
					The todos model isn't readable yet. Run{" "}
					<code>bun run sync-data-model</code>, promote it in the BD
					dashboard, and make sure your secret key carries the{" "}
					<code>metadata:read_records</code> scope (custom objects are a
					plan-gated surface).
				</p>
			) : null}

			{data?.status === "ok" ? (
				data.todos.length === 0 ? (
					<p className="muted">No todos yet — add the first one below.</p>
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
						{data.todos.map((todo) => (
							<li className="bd-card" key={todo.id}>
								<div
									style={{
										alignItems: "center",
										display: "flex",
										gap: "0.5rem",
									}}
								>
									<span className="bd-badge">
										{todo.done ? "Done" : "Open"}
									</span>
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
				)
			) : null}

			{data && data.status !== "unconfigured" ? (
				<section className="bd-section bd-section--narrow" id="add-todo">
					<h2 className="bd-section__title">Add a todo</h2>
					{/* The generated `todo-form` is a normal published form once it's
					    set Live — same client proxy as the contact form. */}
					<BdForm
						slug="todo-form"
						client={bd}
						submitLabel="Add todo"
						onSuccess={() => setRefreshKey((k) => k + 1)}
						successFallback={() => (
							<p>
								Added.{" "}
								<span className="bd-badge">Saved to your custom DB</span>
							</p>
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
	);
}

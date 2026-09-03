import type { Metadata } from "next";

import { TodoCreateForm } from "./TodoCreateForm";
import { api } from "@/trpc/server";

export const metadata: Metadata = {
	title: "Todos",
	description: "Relational custom-collections demo (todos + todoImages).",
};

// Reads the org's custom DB on every request — never statically cache.
export const dynamic = "force-dynamic";

/**
 * The relational custom-collections demo. Two collections declared in
 * `bd.data-model.config.ts` — `todos`, and `todoImages` pointing at a todo
 * via a required RELATION field. This page:
 *
 *   - LISTS todos (with any images joined on) via the tRPC `todos` procedure
 *     → `dataModel.listRecords` — the documented read path.
 *   - CREATES a todo by submitting the generated `todo-form` — the documented
 *     write path (there is no direct row-write API for consumers).
 *
 * Until the model is synced + promoted (and the form set Live) the page shows
 * setup notices instead of failing.
 */
export default async function TodosPage() {
	const { result, formSchema, formSlug } = await api.bd.todos();

	return (
		<main className="bd-section bd-section--narrow">
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">Custom collections</span>
				<h1 className="bd-section__title">Todos</h1>
				<p className="bd-section__sub">
					Rows live in your org&apos;s custom database — two related
					collections (<code>todos</code> + <code>todoImages</code>) declared in{" "}
					<code>bd.data-model.config.ts</code>, read via{" "}
					<code>dataModel.listRecords</code>, created through the generated{" "}
					<code>todo-form</code>.
				</p>
			</div>

			{result.status === "unconfigured" ? (
				<div className="bd-empty">
					BD isn&apos;t configured — set the env vars in <code>.env</code>{" "}
					(see <code>.env.example</code>) to run this demo.
				</div>
			) : result.status === "unavailable" ? (
				<div className="bd-empty">
					The todos model isn&apos;t readable yet. Run{" "}
					<code>pnpm sync-data-model</code>, promote it in the BD dashboard,
					and make sure your secret key carries the{" "}
					<code>metadata:read_records</code> scope (custom objects are a
					plan-gated surface).
				</div>
			) : result.todos.length === 0 ? (
				<div className="bd-empty">No todos yet — add the first one below.</div>
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
						<li className="bd-card" key={todo.id}>
							<div
								style={{ alignItems: "center", display: "flex", gap: "0.5rem" }}
							>
								<span
									className={
										todo.done ? "bd-badge bd-badge--active" : "bd-badge"
									}
								>
									{todo.done ? "Done" : "Open"}
								</span>
								<h3>{todo.title}</h3>
							</div>
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
											{/* Arbitrary external hosts — plain <img> keeps the demo
											    free of next.config image-domain setup. */}
											{/* eslint-disable-next-line @next/next/no-img-element */}
											<img
												alt={image.alt ?? image.label ?? todo.title}
												height={96}
												src={image.url}
												style={{
													borderRadius: "0.5rem",
													objectFit: "cover",
												}}
												width={96}
											/>
											{image.label ? (
												<span style={{ display: "block" }}>{image.label}</span>
											) : null}
										</li>
									))}
								</ul>
							) : null}
						</li>
					))}
				</ul>
			)}

			{result.status !== "unconfigured" ? (
				formSchema ? (
					<TodoCreateForm schema={formSchema} slug={formSlug} />
				) : (
					<div className="bd-empty">
						The create form isn&apos;t live yet — promote the data model and
						activate &quot;Todo Form&quot; (slug <code>todo-form</code>) in the
						dashboard&apos;s Forms surface.
					</div>
				)
			) : null}
		</main>
	);
}

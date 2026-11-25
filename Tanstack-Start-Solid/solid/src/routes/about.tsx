import { createFileRoute } from "@tanstack/solid-router";

export const Route = createFileRoute("/about")({
	component: About,
});

function About() {
	return (
		<main class="page-wrap about-page">
			<section class="island-shell about-card">
				<p class="island-kicker about-kicker">About</p>
				<h1 class="display-title about-title">
					A small starter with room to grow.
				</h1>
				<p class="about-lead">
					TanStack Start gives you type-safe routing, server functions, and
					modern SSR defaults. Use this as a clean foundation, then layer in
					your own routes, styling, and add-ons.
				</p>
			</section>
		</main>
	);
}

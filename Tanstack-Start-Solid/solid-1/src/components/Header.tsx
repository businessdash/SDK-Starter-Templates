import { Link } from "@tanstack/solid-router";

import TanStackQueryHeaderUser from "../integrations/tanstack-query/header-user.tsx";

export default function Header() {
	return (
		<header class="site-header">
			<nav class="page-wrap nav-shell">
				<h2 class="site-brand">
					<Link to="/" class="brand-pill">
						<span class="brand-dot" />
						TanStack Start
					</Link>
				</h2>

				<div class="site-header-user">
					<TanStackQueryHeaderUser />
				</div>

				<div class="site-header-links">
					<Link
						to="/"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						Home
					</Link>
					<Link
						to="/about"
						class="nav-link"
						activeProps={{ class: "nav-link is-active" }}
					>
						About
					</Link>
					<a
						href="https://tanstack.com/start/latest/docs/framework/solid/overview"
						target="_blank"
						rel="noreferrer"
						class="nav-link"
					>
						Docs
					</a>
					<details class="site-header-demos">
						<summary class="nav-link site-header-demos-toggle">Demos</summary>
						<div class="site-header-demos-menu">
							<a
								href="/demo/form"
								class="site-header-demo-link"
							>
								Form
							</a>
							<a
								href="/demo/store"
								class="site-header-demo-link"
							>
								Store
							</a>
							<a
								href="/demo/tanstack-query"
								class="site-header-demo-link"
							>
								TanStack Query
							</a>
						</div>
					</details>
				</div>
			</nav>
		</header>
	);
}

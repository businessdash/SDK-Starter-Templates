import { html, render } from "../html";
import { renderSubscribe } from "./subscribe";

export function renderHeader(): string {
	return render(html`
		<header class="header">
			<a class="brand" href="#hero">Your Business</a>
			<nav>
				<a href="#about">About</a>
				<a href="#services">Services</a>
				<a href="/store">Store</a>
				<a href="/subscriptions">Plans</a>
				<a href="/reviews">Reviews</a>
				<a href="/updates">Updates</a>
				<a href="/todos">Todos</a>
				<a href="/cart">Cart</a>
				<a href="/my-account">Account</a>
			</nav>
		</header>
	`);
}

export function renderFooter(req?: Request): string {
	const year = new Date().getFullYear();
	return render(html`
		<footer class="footer">
			<div class="footer__subscribe">
				${renderSubscribe(
					{
						label: "Subscribe to our newsletter",
						source: "footer",
						buttonLabel: "Subscribe",
						className: "subscribe--footer",
					},
					req,
				)}
			</div>
			<p>© ${year} Your Business — built on BD.</p>
		</footer>
	`);
}

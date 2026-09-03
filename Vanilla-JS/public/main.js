/**
 * Entry point. Each section is its own ES module under
 * `/sections/`; we import them in parallel and let the browser
 * mount each one into its anchor div from `index.html`.
 *
 * Order matches the React-Bun and the upcoming Astro/Nuxt/etc.
 * starters so the same generic business site lands in any
 * framework you pick.
 */

import { renderAbout } from "./sections/about.js";
import { renderBlog } from "./sections/blog.js";
import { renderBooking } from "./sections/booking.js";
import { renderContactForm } from "./sections/contact-form.js";
import { renderGallery } from "./sections/gallery.js";
import { renderHero } from "./sections/hero.js";
import { renderServices } from "./sections/services.js";
import { renderSubscribe } from "./sections/subscribe.js";

document.getElementById("year").textContent = String(new Date().getFullYear());

const mount = (id, render) => {
	const el = document.getElementById(id);
	if (el) render(el).catch((err) => console.error(`[bd] ${id} failed`, err));
};

mount("hero", renderHero);
mount("about", renderAbout);
mount("services", renderServices);
mount("gallery", renderGallery);
mount("booking", renderBooking);
mount("blog", renderBlog);
mount("contact", renderContactForm);

// Footer newsletter signup — the same shared subscribe section as About.
mount("footer-subscribe", (target) =>
	renderSubscribe(target, {
		label: "Subscribe to our newsletter",
		source: "footer",
		idPrefix: "footer-subscribe",
	}),
);

// Privacy-conscious site analytics. Config is injected by the
// Bun server (see server.ts) as `window.__BD_PUBLIC__` so the
// public key never lives in the static bundle.
const cfg =
	(typeof window !== "undefined" &&
		(window).__BD_PUBLIC__) ||
	null;
if (cfg && cfg.siteId && cfg.baseUrl && cfg.apiKey) {
	import("@businessdash/sdk/analytics-core").then(({ initBdAnalytics }) => {
		initBdAnalytics({
			siteId: cfg.siteId,
			baseUrl: cfg.baseUrl,
			apiKey: cfg.apiKey,
		});
	});
}

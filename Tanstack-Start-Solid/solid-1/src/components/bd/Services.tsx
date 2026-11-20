import { For } from "solid-js";

import type { Service } from "../../lib/bd-server-fns";

function formatPrice(s: Service): string {
	if (typeof s.basePrice !== "number") return "Quote on request";
	const prefix = s.priceType === "starting" ? "From " : "";
	return `${prefix}$${s.basePrice}`;
}

export function Services(props: { services: Service[] }) {
	return (
		<section class="bd-section" id="services">
			<div class="bd-section__lead">
				<span class="bd-section__eyebrow">What we do</span>
				<h2 class="bd-section__title">Services</h2>
				<p class="bd-section__sub">
					Clear scope, clear price. Add-ons quoted before any work starts.
				</p>
			</div>
			<div class="bd-grid-3">
				<For each={props.services}>
					{(service) => (
						<article class="bd-card service-card">
							<h3>{service.title}</h3>
							<p>{service.description}</p>
							<div class="service-card__price">{formatPrice(service)}</div>
						</article>
					)}
				</For>
			</div>
		</section>
	);
}

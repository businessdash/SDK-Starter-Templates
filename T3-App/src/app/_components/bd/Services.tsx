import type { Service } from "@/server/api/routers/bd";

function formatPrice(s: Service): string {
	if (typeof s.basePrice !== "number") return "Quote on request";
	const prefix = s.priceType === "starting" ? "From " : "";
	return `${prefix}$${s.basePrice}`;
}

export function Services({ services }: { services: Service[] }) {
	return (
		<section className="bd-section" id="services">
			<div className="bd-section__lead">
				<span className="bd-section__eyebrow">What we do</span>
				<h2 className="bd-section__title">Services</h2>
				<p className="bd-section__sub">
					Clear scope, clear price. Add-ons quoted before any work starts.
				</p>
			</div>
			<div className="bd-grid-3">
				{services.map((service) => (
					<article className="bd-card service-card" key={service.id}>
						<h3>{service.title}</h3>
						<p>{service.description}</p>
						<div className="service-card__price">{formatPrice(service)}</div>
					</article>
				))}
			</div>
		</section>
	);
}

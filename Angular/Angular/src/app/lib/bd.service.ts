import { Injectable, signal } from "@angular/core";
import {
	bdApi,
	type BannerPayload,
	type BlogPost,
	type CartSnapshot,
	type HomePayload,
	type Product,
	type ReviewsAggregate,
	type Subscription,
	type UpdateItem,
} from "./bd-api.client";

/**
 * Marketing/state facade over the local BD endpoints.
 *
 * The browser bundle holds NO API key — every method here fetches from the
 * server endpoints in `src/server/bd-api.ts`. Defaults render immediately
 * (so the page is never blank) and each load enriches its signal when the
 * server responds. When BD env is unset the server returns empty shapes
 * and the defaults stay.
 */

type Hero = { title: string; tagline: string; ctaLabel: string; ctaHref: string };
type AboutBlock = { heading: string; body: string };
type Service = { id: string; name: string; description: string; priceLabel: string };
type BlogEntry = { slug: string; title: string; excerpt: string; publishedAt: string };

const heroDefaults: Hero = {
	title: "Service that shows up — on time.",
	tagline: "Book in 60 seconds. We'll handle the rest.",
	ctaLabel: "Book a consult",
	ctaHref: "#contact",
};

const aboutDefaults: AboutBlock[] = [
	{
		heading: "Family-run for 12 years",
		body: "Honest pricing, the same crew every visit, and the kind of follow-up your neighbour-recommended service should have.",
	},
];

const servicesDefaults: Service[] = [
	{ id: "tuneup", name: "Annual tune-up", description: "Pre-season inspection + tune-up.", priceLabel: "from $149" },
	{ id: "install", name: "Install", description: "New equipment install with a 10-year warranty.", priceLabel: "quote on site" },
	{ id: "repair", name: "Repair", description: "Same-day repair for most makes + models.", priceLabel: "$95 diagnostic" },
];

@Injectable({ providedIn: "root" })
export class BdService {
	// Home/marketing signals
	readonly hero = signal<Hero>(heroDefaults);
	readonly about = signal<AboutBlock[]>(aboutDefaults);
	readonly services = signal<Service[]>(servicesDefaults);
	readonly blog = signal<BlogEntry[]>([]);
	readonly banner = signal<BannerPayload | null>(null);
	readonly updates = signal<UpdateItem[]>([]);
	readonly reviewsAggregate = signal<ReviewsAggregate | null>(null);
	readonly unavailable = signal<boolean>(false);

	private homeLoaded = false;

	/** One round-trip fills hero/about/services/banner/updates/reviews. */
	async loadHome(): Promise<void> {
		if (this.homeLoaded) return;
		this.homeLoaded = true;
		const home = await bdApi.home();
		if (!home || !home.configured) return;
		this.applyHome(home);
	}

	private applyHome(home: HomePayload): void {
		if (home.hero?.headline) {
			this.hero.set({
				title: home.hero.headline,
				tagline: home.hero.subheadline ?? heroDefaults.tagline,
				ctaLabel: home.hero.ctaText ?? heroDefaults.ctaLabel,
				ctaHref: home.hero.ctaLink ?? heroDefaults.ctaHref,
			});
		}
		if (home.about?.heading) {
			this.about.set([{ heading: home.about.heading, body: home.about.body ?? "" }]);
		}
		const items = home.services?.items;
		if (Array.isArray(items) && items.length > 0) {
			this.services.set(
				items.map((s, i) => ({
					id: s.type || `service-${i}`,
					name: s.type,
					description: s.description,
					priceLabel: "Learn more",
				})),
			);
		}
		if (home.banner?.enabled && home.banner.messages?.length) {
			this.banner.set(home.banner);
		}
		if (Array.isArray(home.updates)) this.updates.set(home.updates);
		if (home.reviews) this.reviewsAggregate.set(home.reviews);
	}

	async loadBlog(): Promise<void> {
		const res = await bdApi.blog();
		const items: BlogPost[] = res?.items ?? [];
		if (items.length > 0) {
			this.blog.set(
				items.map((p) => ({
					slug: p.slug,
					title: p.title,
					excerpt: p.excerpt ?? "",
					publishedAt: p.publishedAt ?? "",
				})),
			);
		}
	}

	// Thin pass-throughs the route components use directly.
	products(cursor?: number | null, categoryId?: string) {
		return bdApi.products(cursor, categoryId);
	}
	product(id: string): Promise<Product | null> {
		return bdApi.product(id);
	}
	subscriptions(): Promise<{ items: Subscription[] } | null> {
		return bdApi.subscriptions();
	}
	cart(): Promise<CartSnapshot> {
		return bdApi.cart();
	}
	reviews(offset?: number, limit?: number) {
		return bdApi.reviews(offset, limit);
	}
	portalMe() {
		return bdApi.portalMe();
	}
}

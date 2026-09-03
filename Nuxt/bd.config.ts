/**
 * BD starter — marketing-page schema (single source of truth).
 *
 * This is the same dashboard-editable content model every BD starter
 * template ships, trimmed to a single generic business site. It mirrors the
 * production reference consumer (David's Garage Pro) but stays single-locale
 * and deliberately small so you can read the whole thing.
 *
 * Three things consume this file:
 *
 *   1. `pnpm sync-schema`  — publishes the JSON-Schema artifact to BD's draft
 *      slot. Promote it in the dashboard at Site Builder → Static Data → Schema.
 *   2. `pnpm sync-content` — (optional) pushes your local JSON content tree up
 *      to BD so operators can edit it in the dashboard.
 *   3. `pnpm print-schema` — prints the resolved schema as JSON for debugging.
 *
 * Brand tokens: any string value may reference `{company.phone}` etc. The BD
 * host expands these server-side before returning the bundle, so SEO crawlers
 * see fully-resolved copy. The token map lives in Site Builder → Settings →
 * Brand tokens.
 *
 * Managed-data sections (gallery / blogFeed / productCatalog): rows live OUTSIDE
 * this schema in a BD managed surface. The section here carries presentation
 * CONFIG only (layout, counts). The dashboard renders a "Configure data
 * source →" tile instead of a row editor.
 */

import {
	defineParallelPage,
	defineSiteMarketingSchema,
	section,
} from "@businessdash/sdk";
import { z } from "zod";

// ── Shared sub-schemas ─────────────────────────────────────────────

const navItem = z.object({
	title: z.string(),
	link: z.string(),
	icon: z.string().optional(),
});

const socialLink = z.object({
	name: z.string(),
	href: z.string(),
	icon: z.string().optional(),
});

const serviceItem = z.object({
	type: z.string(),
	description: z.string(),
	image: z.string().optional(),
	icon: z.string().optional(),
	link: z.string().optional(),
});

const serviceArea = z.object({
	name: z.string(),
	slug: z.string(),
	state: z.string(),
	isPrimary: z.boolean().optional(),
});

// ── Schema definition ──────────────────────────────────────────────

export const marketing = defineSiteMarketingSchema({
	brandTokens: [
		"company.name",
		"company.shortName",
		"company.city",
		"company.phone",
		"company.phoneHref",
		"company.email",
		"company.emailHref",
	],
	metadata: {
		project: "bd-starter",
		// Replace with your production origin before publishing.
		siteUrl: "https://example.com",
	},
	// Optional: tells `sync-content` how a local JSON tree maps onto BD
	// pages. Starters ship their content inline in components, so this is a
	// minimal mapping you can grow. `sync-schema` does NOT need it.
	contentSync: {
		rootDir: "src/content",
		locales: ["en"],
		pages: [
			{ dir: "{locale}/shared", pageKey: "shared" },
			{ dir: "{locale}/home", pageKey: "home" },
		],
	},
	sections: {
		// ── Shared site-wide content ──────────────────────────────────

		companyInfo: section({
			label: "Company info",
			description:
				"Single source of truth for company identity/contact. Feeds the `{company.*}` brand tokens used across the whole site.",
			icon: "building",
			schema: z.object({
				name: z.string(),
				shortName: z.string(),
				city: z.string(),
				address: z.string().optional(),
				phone: z.string(),
				phoneHref: z.string(),
				email: z.string(),
				emailHref: z.string(),
				domain: z.string().optional(),
			}),
		}),

		brand: section({
			label: "Brand & SEO",
			description: "Site-wide identity: title, description, tagline, social URLs.",
			icon: "sparkles",
			schema: z.object({
				siteTitle: z.string(),
				siteDescription: z.string(),
				tagline: z.string().optional(),
				logo: z.string().optional(),
				socials: z.array(socialLink).optional(),
			}),
		}),

		nav: section({
			label: "Navigation",
			description: "Primary header navigation links.",
			icon: "menu",
			schema: z.array(navItem),
		}),

		serviceAreas: section({
			label: "Service areas",
			description:
				"Cities/regions served. Drives the location dimension of the programmatic /services/[service]/[area] pages.",
			icon: "map-pin",
			schema: z.object({
				areas: z.array(serviceArea),
			}),
		}),

		newsBanner: section({
			label: "News banner",
			description:
				"Optional dismissible announcement bar. The richer scheduled-message banner is delivered at runtime via `bundle.banner`; this section holds the static fallback copy + enable flag.",
			icon: "megaphone",
			schema: z.object({
				enabled: z.boolean().default(false),
				message: z.string().optional(),
				link: z.string().optional(),
				linkText: z.string().optional(),
			}),
		}),

		// ── Home page ─────────────────────────────────────────────────

		hero: section({
			label: "Hero",
			description: "Top-of-home headline, subhead, primary CTA, background image.",
			icon: "layout",
			schema: z.object({
				headline: z.string(),
				subheadline: z.string().optional(),
				ctaText: z.string().optional(),
				ctaLink: z.string().optional(),
				image: z.string().optional(),
			}),
			ui: {
				subheadline: { widget: "textarea", rows: 3 },
			},
		}),

		about: section({
			label: "About",
			description: "Home about block: heading, body copy, supporting image.",
			icon: "info",
			schema: z.object({
				heading: z.string(),
				body: z.string(),
				image: z.string().optional(),
			}),
			ui: {
				body: { widget: "textarea", rows: 6 },
			},
		}),

		services: section({
			label: "Services",
			description:
				"Services/offerings grid. Drives the service dimension of the programmatic /services/[service]/[area] pages.",
			icon: "list",
			schema: z.object({
				heading: z.string().optional(),
				items: z.array(serviceItem),
			}),
			ui: {
				"items.*.description": { widget: "textarea", rows: 3 },
			},
		}),

		reviews: section({
			label: "Reviews",
			description:
				"Presentation config for the reviews wall. Aggregate + items are delivered at runtime via `client.reviews.list(...)`; this holds the heading and CTA copy.",
			icon: "star",
			schema: z.object({
				heading: z.string().optional(),
				subheading: z.string().optional(),
				ctaText: z.string().optional(),
				ctaLink: z.string().optional(),
			}),
		}),

		contact: section({
			label: "Contact",
			description: "Contact section heading, blurb, and form intro copy.",
			icon: "mail",
			schema: z.object({
				heading: z.string(),
				blurb: z.string().optional(),
				formIntro: z.string().optional(),
			}),
			ui: {
				blurb: { widget: "textarea", rows: 3 },
			},
		}),

		// ── Managed-data sections (rows live in a BD surface) ────────
		//
		// `dataSource.kind` is constrained to the SDK allowlist:
		// `project-media | blog-posts | services-products`. The section
		// schema here is presentation CONFIG only; the dashboard shows a
		// "Configure data source →" tile instead of a row editor.

		gallery: section({
			label: "Gallery",
			description:
				"Project-media gallery. Items come from the BD media library; this section holds layout/title config only.",
			icon: "images",
			schema: z.object({
				title: z.string().optional(),
				layout: z.enum(["grid", "masonry", "carousel"]).default("grid"),
				columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
				maxItems: z.number().int().positive().default(12),
				emptyText: z.string().optional(),
			}),
			dataSource: {
				kind: "project-media",
				configureHref: "/dashboard/projects",
				helpText:
					"Tag media items 'Show in public gallery' in the BD dashboard. They appear here newest-first.",
			},
		}),

		blogFeed: section({
			label: "Blog feed",
			description:
				"Recent posts. Items come from the BD Blog editor; this section holds layout/count config only.",
			icon: "newspaper",
			schema: z.object({
				title: z.string().optional(),
				postCount: z.number().int().positive().default(3),
				layout: z.enum(["grid", "list"]).default("grid"),
				showExcerpt: z.boolean().default(true),
			}),
			dataSource: {
				kind: "blog-posts",
				configureHref: "/dashboard/blog",
				helpText:
					"Authored in the BD Blog editor. Drafts stay unpublished until you flip the toggle.",
			},
		}),

		productCatalog: section({
			label: "Product catalog",
			description:
				"Storefront product list. Items come from the BD services/products surface; this section holds layout/grouping config only.",
			icon: "shopping-bag",
			schema: z.object({
				title: z.string().optional(),
				layout: z.enum(["grid", "list"]).default("grid"),
				columns: z.union([z.literal(2), z.literal(3), z.literal(4)]).default(3),
				groupByCategory: z.boolean().default(true),
				showFeaturedFirst: z.boolean().default(true),
				maxItemsPerCategory: z.number().int().positive().optional(),
				emptyText: z.string().optional(),
			}),
			dataSource: {
				kind: "services-products",
				configureHref: "/dashboard/products",
				helpText:
					"SKUs, descriptions, images, and category live in BD's Products surface. Add the `featured` flag to pin an item to the top of its category.",
			},
		}),
	},
});

// ── Parallel pages (programmatic SEO) ──────────────────────────────
//
// Fans the `services` template out into one URL per (service × area)
// combination. Token resolution (`{service.type}`, `{area.name}`,
// `{area.state}`) happens server-side inside BD so crawlers see
// fully-resolved HTML. Pair this with the /sitemap.xml and /robots.txt
// route handlers in the starter — the platform auto-generates both.

export const serviceAreaPage = defineParallelPage({
	key: "service-area",
	routePattern: "/services/[service]/[area]",
	variables: {
		service: {
			source: { section: "services", path: "items" },
			slugField: "type",
			tokenFields: ["type", "description"],
		},
		area: {
			source: { section: "serviceAreas", path: "areas" },
			slugField: "slug",
			tokenFields: ["name", "state", "slug"],
		},
	},
	meta: {
		title: "{service.type} in {area.name}, {area.state} | {company.shortName}",
		description:
			"Professional {service.type} in {area.name}. {company.shortName} — call {company.phone} for fast, reliable service.",
		canonical: "https://{company.domain}/services/{service.type}/{area.slug}",
	},
	templateRef: "services",
});

export const parallelPages = [serviceAreaPage];

import type { FormSchema as SdkFormSchema } from "@businessdash/sdk";
import { TRPCError } from "@trpc/server";
import { z } from "zod";

import { TODO_FORM_SLUG } from "../../../../bd.data-model.config";
import { createTRPCRouter, publicProcedure } from "@/server/api/trpc";
import { getBd } from "@/server/lib/bd";
import { listTodosWithImages } from "@/server/lib/bd-todos";

/**
 * The BD tRPC surface. One router groups every SDK call the
 * consumer site needs — `home` aggregates the static-data reads,
 * the others are interactive (slot fetch, booking confirm, form
 * submit).
 *
 * tRPC's type-flow does the heavy lifting: each procedure's return
 * shape is inferred end-to-end, so the client components consume
 * the data with full IntelliSense + no manual types.
 *
 * Procedures are `publicProcedure` because BD content is public
 * to the site's visitors — the bearer key on the server-side SDK
 * client is what actually authenticates against BD.
 */

export type HeroData = {
	title: string;
	tagline: string;
	ctaLabel: string;
	ctaHref: string;
};

export type Service = {
	id: string;
	title: string;
	description: string;
	basePrice?: number;
	priceType?: string;
};

export type GalleryItem = {
	id: string;
	src?: string | null;
	title?: string | null;
	category?: string | null;
	blurDataURL?: string | null;
};

export type EventType = {
	id: string;
	name: string;
	slug: string;
	durationMinutes: number;
};

export type BlogPost = {
	id: string;
	slug: string;
	title: string;
	excerpt?: string | null;
	publishedAt?: string | null;
};

export type FieldDef = {
	id: string;
	label: string;
	type: string;
	required: boolean;
	placeholder?: string;
	helpText?: string;
};

export type FormSchema = {
	id: string;
	slug: string;
	title?: string;
	description?: string | null;
	fields: FieldDef[];
};

const HERO_DEFAULTS: HeroData = {
	title: "Service that shows up — on time.",
	tagline: "Book in 60 seconds. We'll handle the rest.",
	ctaLabel: "Book a consult",
	ctaHref: "#booking",
};

const ABOUT_FALLBACK =
	"We're a small team that takes pride in being available. Real schedule, real reviews, real follow-up — no automated runaround. Book a slot below or send us a note and we'll get right back to you.";

const SERVICES_FALLBACK: Service[] = [
	{
		id: "f1",
		title: "Standard Service Call",
		description: "Initial visit, diagnosis, and a written estimate.",
		basePrice: 95,
		priceType: "flat",
	},
	{
		id: "f2",
		title: "Tune-up + Inspection",
		description: "Annual maintenance with a 14-point checklist.",
		basePrice: 149,
		priceType: "flat",
	},
	{
		id: "f3",
		title: "Emergency Visit",
		description: "Same-day arrival for urgent issues.",
		basePrice: 225,
		priceType: "starting",
	},
];

const FORM_SLUG = "general-inquiry";

const FORM_FALLBACK: FormSchema = {
	id: "fallback",
	slug: FORM_SLUG,
	title: "Get in touch",
	description: "We'll get back within one business day.",
	fields: [
		{ id: "name", label: "Name", type: "text", required: true },
		{ id: "email", label: "Email", type: "email", required: true },
		{ id: "message", label: "Message", type: "textarea", required: true },
	],
};

const GALLERY_FIELDS = [
	"id",
	"src",
	"title",
	"category",
	"blurDataURL",
] as const;

export const bdRouter = createTRPCRouter({
	/**
	 * Aggregates every static surface the home page renders into a
	 * single tRPC call. Server Components call this from the page
	 * via `api.bd.home()` — the data is already shaped for the
	 * section components.
	 */
	home: publicProcedure.query(async () => {
		const bd = getBd();
		if (!bd) {
			return {
				hero: HERO_DEFAULTS,
				about: ABOUT_FALLBACK,
				services: SERVICES_FALLBACK,
				gallery: [] as GalleryItem[],
				eventTypes: [] as EventType[],
				blogPosts: [] as BlogPost[],
				formSchema: FORM_FALLBACK,
				formSlug: FORM_SLUG,
			};
		}

		const [bundle, gallery, eventTypes, blog, formSchema] = await Promise.all([
			bd.marketing
				.getPageBundle({ pageKey: "home", locale: "en" })
				.catch(() => null),
			bd.gallery
				.list({ limit: 12, fields: GALLERY_FIELDS })
				.catch(() => []) as Promise<GalleryItem[]>,
			bd.scheduling.listEventTypes().catch(() => []) as Promise<EventType[]>,
			bd.blog
				.listPosts({ limit: 6 })
				.catch(() => ({ items: [] as BlogPost[] })),
			bd.forms.schema(FORM_SLUG).catch(() => FORM_FALLBACK),
		]);

		function readSection(name: string): Record<string, unknown> | null {
			const raw = (bundle as { sections?: Record<string, unknown> })
				?.sections?.[name];
			if (
				raw &&
				typeof raw === "object" &&
				"ok" in raw &&
				(raw as { ok: boolean }).ok
			) {
				return (raw as unknown as { data: Record<string, unknown> }).data;
			}
			return null;
		}

		const heroSection = readSection("hero");
		const aboutSection = readSection("about");
		const servicesSection = readSection("services");

		return {
			hero: {
				title: (heroSection?.title as string) ?? HERO_DEFAULTS.title,
				tagline: (heroSection?.tagline as string) ?? HERO_DEFAULTS.tagline,
				ctaLabel: (heroSection?.ctaLabel as string) ?? HERO_DEFAULTS.ctaLabel,
				ctaHref: (heroSection?.ctaHref as string) ?? HERO_DEFAULTS.ctaHref,
			} satisfies HeroData,
			about:
				typeof aboutSection?.body === "string"
					? aboutSection.body
					: ABOUT_FALLBACK,
			services:
				Array.isArray(servicesSection?.items) &&
				(servicesSection.items as Service[]).length > 0
					? (servicesSection.items as Service[])
					: SERVICES_FALLBACK,
			gallery,
			eventTypes,
			blogPosts: ((blog as { items?: BlogPost[] })?.items as BlogPost[]) ?? [],
			formSchema,
			formSlug: FORM_SLUG,
		};
	}),

	fetchSlots: publicProcedure
		.input(
			z.object({
				slug: z.string().min(1),
				from: z.coerce.date(),
				to: z.coerce.date(),
			}),
		)
		.query(async ({ input }) => {
			const bd = getBd();
			if (!bd) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "BD not configured. See .env.example.",
				});
			}
			try {
				return await bd.scheduling.getAvailableSlots(input.slug, {
					from: input.from,
					to: input.to,
				});
			} catch (err) {
				throw new TRPCError({
					code: "BAD_GATEWAY",
					message: err instanceof Error ? err.message : "Unknown error",
				});
			}
		}),

	confirmBooking: publicProcedure
		.input(
			z.object({
				eventTypeSlug: z.string().min(1),
				startAt: z.coerce.date(),
				invitee: z.object({
					email: z.string().email(),
					name: z.string().min(1),
					phone: z.string().nullable().optional(),
					timezone: z.string().min(1),
				}),
				notes: z.string().nullable().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const bd = getBd();
			if (!bd) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "BD not configured.",
				});
			}
			try {
				return await bd.scheduling.confirmBooking({
					eventTypeSlug: input.eventTypeSlug,
					startAt: input.startAt,
					invitee: input.invitee,
					notes: input.notes ?? null,
				});
			} catch (err) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: err instanceof Error ? err.message : "Couldn't confirm.",
				});
			}
		}),

	submitForm: publicProcedure
		.input(
			z.object({
				slug: z.string().min(1),
				data: z.record(z.string(), z.unknown()),
				submitterEmail: z.string().email().optional(),
				submitterName: z.string().optional(),
			}),
		)
		.mutation(async ({ input }) => {
			const bd = getBd();
			if (!bd) {
				throw new TRPCError({
					code: "INTERNAL_SERVER_ERROR",
					message: "BD not configured.",
				});
			}
			try {
				return await bd.forms.submit(input.slug, input.data, {
					submitterEmail: input.submitterEmail,
					submitterName: input.submitterName,
				});
			} catch (err) {
				throw new TRPCError({
					code: "BAD_REQUEST",
					message: err instanceof Error ? err.message : "Couldn't submit.",
				});
			}
		}),

	/**
	 * The `/todos` page's read: todos + their images out of the org's custom
	 * database (see `bd.data-model.config.ts`), plus the generated create
	 * form's schema. The form schema is `null` until the model is promoted and
	 * "Todo Form" is set Live — the page shows a setup notice instead.
	 */
	todos: publicProcedure.query(async () => {
		const bd = getBd();
		const [result, formSchema] = await Promise.all([
			listTodosWithImages(),
			bd
				? (bd.forms
						.schema(TODO_FORM_SLUG)
						.catch(() => null) as Promise<SdkFormSchema | null>)
				: Promise.resolve(null),
		]);
		return { result, formSchema, formSlug: TODO_FORM_SLUG };
	}),

	/**
	 * A deeper page of public reviews than the marketing bundle ships. The
	 * bundle gives the aggregate (count / average) + the first page; the
	 * reviews wall calls this with the previous `nextOffset` to "load more".
	 * Returns an empty page (rather than throwing) when unconfigured so the
	 * UI just stops paginating.
	 */
	reviewsPage: publicProcedure
		.input(
			z.object({
				limit: z.number().int().min(1).max(50).optional(),
				offset: z.number().int().min(0).optional(),
				source: z.enum(["google", "yelp", "housecall_pro", "other"]).optional(),
			}),
		)
		.query(async ({ input }) => {
			const bd = getBd();
			if (!bd) {
				return { items: [], totalCount: 0, nextOffset: null } as const;
			}
			try {
				return await bd.reviews.list(input);
			} catch (err) {
				if (process.env.NODE_ENV === "development") {
					const reason = err instanceof Error ? err.message : String(err);
					console.warn(`[bd] reviews.list failed: ${reason}`);
				}
				return { items: [], totalCount: 0, nextOffset: null } as const;
			}
		}),
});

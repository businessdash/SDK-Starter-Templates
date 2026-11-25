/**
 * The storefront's shared logic: product shaping for the product page, and
 * what the visitor's saved lists (wishlist, compare, recently viewed) keep.
 * It is the web starters' `src/shop/shop.ts`, less the parts that need a
 * browser (localStorage lists, the web share sheet).
 *
 * Framework-free on purpose. The pages render what these functions return,
 * so the rules (which photos show for an option, what "from $40" means, how
 * many products fit the compare table) live in one place.
 *
 * Money: product cards carry integer CENTS (`cheapestPriceCents`); variants,
 * options and cart lines carry DOLLARS. Each value below says which.
 */

/** JSON from outside, as the fields read from it; each is checked before use. */
type Fields<K extends string> = { readonly [P in K]?: unknown };

// ── Product page ────────────────────────────────────────────────────

export type ProductVariant = {
	id: string;
	name: string;
	/** Dollars. */
	price: number | null;
	/** null: not tracked. */
	stock: number | null;
	available: boolean;
};

export type OptionValue = {
	id: string;
	value: string;
	/** Dollars, added to the option total. */
	price: number;
	available: boolean;
};

export type OptionGroup = { id: string; title: string; values: OptionValue[] };

export type SpecGroup = { name: string; rows: { label: string; value: string }[] };

export type ProductView = {
	id: string;
	name: string;
	description: string;
	categoryId: string | null;
	categoryName: string | null;
	images: string[];
	variants: ProductVariant[];
	/** Photos of one variant, in order. */
	variantImages: { variantId: string; url: string; order: number }[];
	optionTitles: { id: string; title: string; variantId: string | null }[];
	optionValues: (OptionValue & { titleId: string; stock: number | null })[];
	features: string[];
	specs: SpecGroup[];
};

const text = (v: unknown): string => (typeof v === "string" ? v.trim() : "");
const num = (v: unknown): number | null =>
	typeof v === "number" && Number.isFinite(v) ? v : null;
const records = <K extends string>(v: unknown): Fields<K>[] =>
	Array.isArray(v) ? v.filter((x): x is Fields<K> => !!x && typeof x === "object") : [];

/** Read the specifications column (`{ features, groups: [{ name, rows }] }`). */
export function readSpecs(raw: unknown): { features: string[]; specs: SpecGroup[] } {
	const obj: Fields<"features" | "groups"> = raw && typeof raw === "object" ? raw : {};
	const features = Array.isArray(obj.features)
		? obj.features.map(text).filter(Boolean)
		: [];
	const specs = records<"name" | "rows">(obj.groups)
		.map((group) => ({
			name: text(group.name),
			rows: records<"label" | "value">(group.rows)
				.map((row) => ({ label: text(row.label), value: text(row.value) }))
				.filter((row) => row.label && row.value),
		}))
		.filter((group) => group.name && group.rows.length > 0);
	return { features, specs };
}

/** Shape a `storefront.getProduct` response for the product page. */
export function toProductView(product: object): ProductView {
	const detail: Fields<
		| "id"
		| "name"
		| "description"
		| "categoryId"
		| "category"
		| "images"
		| "productImages"
		| "variants"
		| "variantImages"
		| "crossVariantTitles"
		| "crossVariants"
		| "specifications"
	> = product;
	const category: Fields<"name"> | null =
		detail.category && typeof detail.category === "object" ? detail.category : null;
	const productImages = records<"url" | "order">(detail.productImages)
		.map((image) => ({ url: text(image.url), order: num(image.order) ?? 0 }))
		.filter((image) => image.url)
		.sort((a, b) => a.order - b.order)
		.map((image) => image.url);
	const images = Array.isArray(detail.images)
		? detail.images.map(text).filter(Boolean)
		: [];
	return {
		id: text(detail.id),
		name: text(detail.name) || "Untitled",
		description: text(detail.description),
		categoryId: text(detail.categoryId) || null,
		categoryName: category ? text(category.name) || null : null,
		images: images.length > 0 ? images : productImages,
		variants: records<"id" | "name" | "price" | "stock" | "isLive">(detail.variants).map((variant) => ({
			id: text(variant.id),
			name: text(variant.name) || "Default",
			price: num(variant.price),
			stock: num(variant.stock),
			available: variant.isLive !== false && num(variant.stock) !== 0,
		})),
		variantImages: records<"variantId" | "url" | "order">(detail.variantImages)
			.map((image) => ({
				variantId: text(image.variantId),
				url: text(image.url),
				order: num(image.order) ?? 0,
			}))
			.filter((image) => image.url),
		optionTitles: records<"id" | "title" | "variantId">(detail.crossVariantTitles).map((title) => ({
			id: text(title.id),
			title: text(title.title),
			variantId: text(title.variantId) || null,
		})),
		optionValues: records<"id" | "crossVariantTitleId" | "value" | "price" | "stock" | "isLive">(detail.crossVariants).map((option) => ({
			id: text(option.id),
			titleId: text(option.crossVariantTitleId),
			value: text(option.value),
			price: num(option.price) ?? 0,
			stock: num(option.stock),
			available: option.isLive !== false && num(option.stock) !== 0,
		})),
		...readSpecs(detail.specifications),
	};
}

/** The variant a page opens on: the first one that can be bought. */
export function defaultVariant(view: ProductView): ProductVariant | undefined {
	return view.variants.find((v) => v.available) ?? view.variants[0];
}

/** The photos for a variant: its own when it has any, else the product's. */
export function galleryFor(view: ProductView, variantId: string): string[] {
	const own = view.variantImages
		.filter((image) => image.variantId === variantId)
		.sort((a, b) => a.order - b.order)
		.map((image) => image.url);
	return own.length > 0 ? own : view.images;
}

const SIZE_ORDER = ["XXS", "2XS", "XS", "S", "SM", "M", "MD", "L", "LG", "XL", "2XL", "XXL", "3XL", "4XL"];

/** The option groups (Size, Colour…) that apply to a variant. */
export function optionGroupsFor(view: ProductView, variantId: string): OptionGroup[] {
	return view.optionTitles
		.filter((title) => title.variantId === null || title.variantId === variantId)
		.map((title) => {
			const values = view.optionValues.filter((option) => option.titleId === title.id);
			if (/^sizes?$/i.test(title.title)) {
				const rank = (v: string) => {
					const i = SIZE_ORDER.indexOf(v.toUpperCase());
					return i === -1 ? SIZE_ORDER.length : i;
				};
				values.sort((a, b) => rank(a.value) - rank(b.value));
			}
			return { id: title.id, title: title.title, values };
		})
		.filter((group) => group.values.length > 0);
}

export type Price = {
	/** Dollars; null when there is nothing to buy. */
	amount: number | null;
	/** True while options are still being chosen: the lowest it can be. */
	from: boolean;
	stock: number | null;
	/** Every option group has a choice and the choice can be bought. */
	ready: boolean;
};

/**
 * The price shown for a variant and the options chosen so far (`chosen` maps
 * an option group's id to an option value's id).
 */
export function priceFor(
	view: ProductView,
	variantId: string,
	chosen: Record<string, string>,
): Price {
	const variant = view.variants.find((v) => v.id === variantId);
	if (!variant?.available) {
		return { amount: null, from: false, stock: 0, ready: false };
	}
	const groups = optionGroupsFor(view, variantId);
	if (groups.length === 0) {
		return { amount: variant.price, from: false, stock: variant.stock, ready: true };
	}
	const picks = groups.map((group) =>
		group.values.find((value) => value.id === chosen[group.id]),
	);
	if (picks.some((pick) => !pick)) {
		const lowest = groups.map((group) => {
			const open = group.values.filter((value) => value.available);
			return open.length ? Math.min(...open.map((value) => value.price)) : 0;
		});
		return { amount: lowest.reduce((a, b) => a + b, 0), from: true, stock: null, ready: false };
	}
	if (picks.some((pick) => !pick?.available)) {
		return { amount: null, from: false, stock: 0, ready: false };
	}
	const stocks = picks
		.map((pick) => view.optionValues.find((v) => v.id === pick?.id)?.stock ?? null)
		.filter((stock): stock is number => stock !== null);
	return {
		amount: picks.reduce((sum, pick) => sum + (pick?.price ?? 0), 0),
		from: false,
		stock: stocks.length ? Math.min(...stocks) : null,
		ready: true,
	};
}

/** The chosen options as the cart line's `options` ({ Size: "M" }). */
export function chosenOptions(
	view: ProductView,
	variantId: string,
	chosen: Record<string, string>,
): Record<string, string> | undefined {
	const out: Record<string, string> = {};
	for (const group of optionGroupsFor(view, variantId)) {
		const value = group.values.find((v) => v.id === chosen[group.id]);
		if (value) out[group.title] = value.value;
	}
	return Object.keys(out).length ? out : undefined;
}

// ── Money ───────────────────────────────────────────────────────────

export function formatDollars(amount: number, currency = "USD"): string {
	try {
		return new Intl.NumberFormat("en-US", {
			style: "currency",
			currency: currency.toUpperCase(),
		}).format(amount);
	} catch {
		return `$${amount.toFixed(2)}`;
	}
}

export function formatCents(cents: number, currency = "USD"): string {
	return formatDollars(cents / 100, currency);
}

// ── The visitor's saved lists ───────────────────────────────────────

/** What a list keeps of a product: enough to draw a card without a fetch. */
export type SavedProduct = {
	id: string;
	name: string;
	image: string | null;
	/** Cents. */
	priceCents: number | null;
};

// The lists themselves are `saved.ts` here: AsyncStorage, where the web
// starters use localStorage. Sharing is React Native's `Share`.

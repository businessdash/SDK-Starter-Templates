<!-- [bd-file:store] -->
<script setup lang="ts">
import { computed, onMounted, ref, watch } from "vue";
import BdFooter from "~/components/bd/BdFooter.vue";
import BdHeader from "~/components/bd/BdHeader.vue";
import CompareBar from "~/components/bd/CompareBar.vue";
import ProductRail from "~/components/bd/ProductRail.vue";
import SaveButtons from "~/components/bd/SaveButtons.vue";
import StarRating from "~/components/bd/StarRating.vue";
import StoreNav from "~/components/bd/StoreNav.vue";
import { useCart } from "~/composables/useCart";
import {
	chosenOptions,
	defaultVariant,
	formatCents,
	formatDollars,
	galleryFor,
	optionGroupsFor,
	priceFor,
	recentlyViewed,
	type SavedProduct,
	shareLink,
	toProductView,
} from "#shared/bd/shop";
import type { StoreProductResult } from "../../../server/api/bd/store/product/[id].get";

/**
 * Product page: photos that follow the chosen option, option and size
 * buttons, the price for what's chosen, add to cart (the options travel with
 * the cart line), save and compare, share, details, add-ons, reviews with
 * "Show more" (`?reviews=20`), related products and what was viewed before.
 * Shop logic is in `#shared/bd/shop`; this file is the view.
 */
const route = useRoute();
const id = computed(() => String(route.params.id));
const reviewLimit = computed(() => route.query.reviews ?? undefined);

const { data } = await useFetch<StoreProductResult>(
	() => `/api/bd/store/product/${id.value}`,
	{ query: computed(() => (reviewLimit.value ? { reviews: reviewLimit.value } : {})) },
);
if (data.value && !data.value.product && !data.value.suspended) {
	throw createError({ statusCode: 404, statusMessage: "Product not found", fatal: true });
}

const view = computed(() =>
	data.value?.product ? toProductView(data.value.product as Record<string, unknown>) : null,
);

const variantId = ref("");
const chosen = ref<Record<string, string>>({});
const photo = ref(0);
const quantity = ref(1);
const message = ref<{ kind: "ok" | "error"; text: string } | null>(null);
const shareNote = ref("");
const addingAddon = ref<string | null>(null);
const addedAddons = ref<Record<string, boolean>>({});
const recent = ref<SavedProduct[]>([]);
const cartCount = useState<number>("bd-cart-count", () => 0);
const { addItem, busy, error, cart } = useCart();

// A new product (following a related link) starts over.
watch(
	() => view.value?.id,
	() => {
		variantId.value = view.value ? (defaultVariant(view.value)?.id ?? "") : "";
		chosen.value = {};
		photo.value = 0;
		quantity.value = 1;
		message.value = null;
	},
	{ immediate: true },
);

const gallery = computed(() => (view.value ? galleryFor(view.value, variantId.value) : []));
const groups = computed(() => (view.value ? optionGroupsFor(view.value, variantId.value) : []));
const price = computed(() =>
	view.value ? priceFor(view.value, variantId.value, chosen.value) : null,
);
const summary = computed<SavedProduct | null>(() => {
	if (!view.value) return null;
	const dollars = price.value?.amount ?? view.value.variants[0]?.price ?? null;
	return {
		id: view.value.id,
		name: view.value.name,
		image: view.value.images[0] ?? null,
		priceCents: dollars != null ? Math.round(dollars * 100) : null,
	};
});
const cta = computed(() =>
	!price.value || price.value.amount === null
		? "Sold out"
		: !price.value.ready
			? "Choose options"
			: busy.value
				? "Adding…"
				: "Add to cart",
);
const related = computed<SavedProduct[]>(() =>
	(data.value?.related ?? []).map((rp) => ({
		id: rp.id,
		name: rp.name,
		image: rp.coverImageUrl,
		priceCents: rp.minPriceDollars != null ? Math.round(rp.minPriceDollars * 100) : null,
	})),
);
const moreReviews = computed(() =>
	data.value?.reviews ? data.value.reviews.totalCount > data.value.reviews.items.length : false,
);

onMounted(() => {
	if (!summary.value) return;
	// Shown before this one is added, so the product isn't in its own list.
	recent.value = recentlyViewed.read().filter((item) => item.id !== summary.value?.id);
	recentlyViewed.add(summary.value);
});

function pickVariant(next: string) {
	variantId.value = next;
	chosen.value = {};
	photo.value = 0;
}

function step(by: number) {
	photo.value = (photo.value + by + gallery.value.length) % gallery.value.length;
}

async function handleAdd() {
	if (!view.value || !price.value?.ready) return;
	message.value = null;
	const ok = await addItem({
		productId: view.value.id,
		variantId: variantId.value || null,
		quantity: quantity.value,
		options: chosenOptions(view.value, variantId.value, chosen.value),
	});
	if (ok) {
		cartCount.value = cart.value?.itemCount ?? cartCount.value + quantity.value;
		message.value = { kind: "ok", text: `Added ${quantity.value} to your cart.` };
	} else {
		message.value = { kind: "error", text: error.value ?? "Couldn't add that. Try again." };
	}
}

type Addon = StoreProductResult["addons"][number];
async function handleAddAddon(addon: Addon) {
	addingAddon.value = addon.id;
	const first = (Array.isArray(addon.variants) ? addon.variants[0] : undefined) as
		| { variantId?: unknown; id?: unknown }
		| undefined;
	const variant = first?.variantId ?? first?.id;
	const ok = await addItem({
		productId: addon.addonProductId,
		variantId: typeof variant === "string" ? variant : null,
		quantity: 1,
	});
	addingAddon.value = null;
	if (ok) {
		cartCount.value = cart.value?.itemCount ?? cartCount.value + 1;
		addedAddons.value = { ...addedAddons.value, [addon.id]: true };
	}
}

async function share() {
	if (!view.value) return;
	const url = `${window.location.origin}${route.path}`;
	const result = await shareLink(url, view.value.name);
	shareNote.value = result === "copied" ? "Link copied" : result === "failed" ? "Couldn't share" : "";
	if (shareNote.value) setTimeout(() => (shareNote.value = ""), 2500);
}

function text(value: unknown): string {
	return typeof value === "string" ? value : "";
}
function reviewDate(iso: unknown): string {
	const date = typeof iso === "string" ? new Date(iso) : null;
	return date && !Number.isNaN(date.getTime())
		? date.toLocaleDateString(undefined, { year: "numeric", month: "short", day: "numeric" })
		: "";
}

useHead(() => ({
	title: view.value ? `${view.value.name} — Your Business` : "Product — Your Business",
	meta: [
		...(view.value?.description
			? [{ name: "description", content: view.value.description.slice(0, 160) }]
			: []),
		...(gallery.value[0] ? [{ property: "og:image", content: gallery.value[0] }] : []),
	],
}));
</script>

<template>
	<div>
		<BdHeader />
		<StoreNav />
		<main class="bd-section">
			<div v-if="data?.suspended" class="bd-empty">
				The store is temporarily unavailable. Please check back soon.
			</div>
			<template v-else-if="view">
				<nav class="crumbs" aria-label="Breadcrumb">
					<NuxtLink to="/store">Store</NuxtLink>
					<template v-if="view.categoryId">
						<span aria-hidden="true">/</span>
						<NuxtLink :to="`/store?category=${view.categoryId}`">
							{{ view.categoryName ?? "Category" }}
						</NuxtLink>
					</template>
					<span aria-hidden="true">/</span>
					<span aria-current="page">{{ view.name }}</span>
				</nav>

				<div class="product-detail">
					<div class="gallery">
						<div class="gallery__main">
							<img
								v-if="gallery[photo]"
								:src="gallery[photo]"
								:alt="view.name"
								referrerpolicy="no-referrer"
							/>
							<div v-else class="gallery__placeholder">No photo yet</div>
							<template v-if="gallery.length > 1">
								<button
									type="button"
									class="gallery__step gallery__step--prev"
									aria-label="Previous photo"
									@click="step(-1)"
								>
									‹
								</button>
								<button
									type="button"
									class="gallery__step gallery__step--next"
									aria-label="Next photo"
									@click="step(1)"
								>
									›
								</button>
							</template>
						</div>
						<div v-if="gallery.length > 1" class="gallery__thumbs">
							<button
								v-for="(src, i) in gallery"
								:key="src + i"
								type="button"
								class="gallery__thumb"
								:class="{ 'gallery__thumb--on': i === photo }"
								:aria-label="`Photo ${i + 1} of ${gallery.length}`"
								:aria-current="i === photo"
								@click="photo = i"
							>
								<img :src="src" alt="" loading="lazy" referrerpolicy="no-referrer" />
							</button>
						</div>
					</div>

					<div class="product-detail__info bd-card">
						<div>
							<p v-if="view.categoryName" class="product-detail__eyebrow">
								{{ view.categoryName }}
							</p>
							<h1>{{ view.name }}</h1>
							<a
								v-if="data?.reviews && data.reviews.totalCount > 0"
								class="product-detail__rating"
								href="#reviews"
							>
								<StarRating :rating="data.reviews.avgRating" />
								<span>
									{{ data.reviews.avgRating.toFixed(1) }} ·
									{{ data.reviews.totalCount }} reviews
								</span>
							</a>
						</div>

						<p class="product-detail__price">
							<template v-if="price?.amount != null">
								<span v-if="price.from" class="product-detail__from">From</span>
								{{ formatDollars(price.amount * quantity) }}
								<span v-if="quantity > 1" class="product-detail__each">
									({{ formatDollars(price.amount) }} each)
								</span>
							</template>
							<template v-else>Sold out</template>
						</p>

						<p v-if="view.description" class="product-detail__desc">
							{{ view.description }}
						</p>

						<fieldset v-if="view.variants.length > 1" class="choice">
							<legend class="bd-label">Option</legend>
							<div class="choice__values">
								<button
									v-for="v in view.variants"
									:key="v.id"
									type="button"
									class="choice__value"
									:class="{ 'choice__value--on': v.id === variantId }"
									:aria-pressed="v.id === variantId"
									:disabled="!v.available"
									@click="pickVariant(v.id)"
								>
									{{ v.name }}
									<small v-if="v.price != null && groups.length === 0">
										{{ formatDollars(v.price) }}
									</small>
								</button>
							</div>
						</fieldset>

						<fieldset v-for="group in groups" :key="group.id" class="choice">
							<legend class="bd-label">
								{{ group.title }}
								<span v-if="chosen[group.id]" class="choice__picked">
									{{ group.values.find((v) => v.id === chosen[group.id])?.value }}
								</span>
							</legend>
							<div class="choice__values">
								<button
									v-for="value in group.values"
									:key="value.id"
									type="button"
									class="choice__value"
									:class="{ 'choice__value--on': chosen[group.id] === value.id }"
									:aria-pressed="chosen[group.id] === value.id"
									:disabled="!value.available"
									:title="value.available ? undefined : 'Sold out'"
									@click="chosen = { ...chosen, [group.id]: value.id }"
								>
									{{ value.value }}
								</button>
							</div>
						</fieldset>

						<p
							v-if="price?.stock != null && price.stock > 0 && price.stock <= 5"
							class="product-detail__stock"
						>
							Only {{ price.stock }} left
						</p>

						<div class="buy">
							<div class="qty" role="group" aria-label="Quantity">
								<button
									type="button"
									aria-label="One fewer"
									:disabled="quantity <= 1"
									@click="quantity = Math.max(1, quantity - 1)"
								>
									−
								</button>
								<span aria-live="polite">{{ quantity }}</span>
								<button
									type="button"
									aria-label="One more"
									:disabled="price?.stock != null && quantity >= price.stock"
									@click="quantity = Math.min(999, quantity + 1)"
								>
									+
								</button>
							</div>
							<button
								class="bd-btn buy__add"
								type="button"
								:disabled="busy || !price?.ready"
								@click="handleAdd"
							>
								{{ cta }}
							</button>
						</div>

						<div
							v-if="message"
							class="product-detail__msg"
							:class="{ 'product-detail__msg--err': message.kind === 'error' }"
							role="status"
						>
							{{ message.text }}
							<NuxtLink v-if="message.kind === 'ok'" class="bd-btn bd-btn--ghost" to="/cart">
								View cart
							</NuxtLink>
						</div>

						<div class="product-detail__tools">
							<SaveButtons v-if="summary" :product="summary" />
							<button type="button" class="share" @click="share">
								<span aria-hidden="true">↗</span> Share
							</button>
							<span v-if="shareNote" class="share__note" role="status">{{ shareNote }}</span>
						</div>

						<ul class="policies">
							<li>Secure checkout with Stripe</li>
							<li>Questions? <NuxtLink to="/#contact">Ask us</NuxtLink> before you buy</li>
						</ul>
					</div>
				</div>

				<section
					v-if="view.features.length > 0 || view.specs.length > 0"
					id="specs"
					class="product-section"
				>
					<h2 class="product-section__title">Details</h2>
					<ul v-if="view.features.length > 0" class="features">
						<li v-for="feature in view.features" :key="feature">{{ feature }}</li>
					</ul>
					<table v-for="group in view.specs" :key="group.name" class="specs">
						<caption>{{ group.name }}</caption>
						<tbody>
							<tr v-for="row in group.rows" :key="row.label">
								<th scope="row">{{ row.label }}</th>
								<td>{{ row.value }}</td>
							</tr>
						</tbody>
					</table>
				</section>

				<section v-if="data?.addons.length" class="product-section">
					<h2 class="product-section__title">Complete your purchase</h2>
					<div class="addon-grid">
						<div v-for="addon in data.addons" :key="addon.id" class="addon-card bd-card">
							<div class="addon-card__media">
								<img
									v-if="addon.imageUrl"
									:src="addon.imageUrl"
									:alt="addon.addonName"
									loading="lazy"
									referrerpolicy="no-referrer"
								/>
								<div v-else class="addon-card__noimg">—</div>
							</div>
							<div class="addon-card__body">
								<span v-if="addon.groupLabel" class="addon-card__group">
									{{ addon.groupLabel }}
								</span>
								<p class="addon-card__name">{{ addon.addonName }}</p>
								<span v-if="addon.priceCents != null" class="addon-card__price">
									{{ formatCents(addon.priceCents) }}
								</span>
							</div>
							<button
								type="button"
								class="bd-btn bd-btn--ghost addon-card__add"
								:disabled="addingAddon === addon.id || addedAddons[addon.id]"
								@click="handleAddAddon(addon)"
							>
								{{ addedAddons[addon.id] ? "Added" : addingAddon === addon.id ? "…" : "Add" }}
							</button>
						</div>
					</div>
				</section>

				<section id="reviews" class="product-section">
					<h2 class="product-section__title">Reviews</h2>
					<template v-if="data?.reviews && data.reviews.items.length > 0">
						<p class="reviews__summary">
							<StarRating :rating="data.reviews.avgRating" />
							<strong>{{ data.reviews.avgRating.toFixed(1) }} out of 5</strong>
							<span>from {{ data.reviews.totalCount }} reviews</span>
						</p>
						<div class="review-list">
							<article v-for="review in data.reviews.items" :key="review.id" class="review">
								<div class="review__head">
									<StarRating :rating="review.rating" />
									<span class="review__name">
										{{ text(review.reviewerName) || "Verified buyer" }}
									</span>
									<span class="review__date">{{ reviewDate(review.createdAt) }}</span>
								</div>
								<p v-if="text(review.title)" class="review__title">{{ text(review.title) }}</p>
								<p v-if="text(review.content) || text(review.body)" class="review__body">
									{{ text(review.content) || text(review.body) }}
								</p>
							</article>
						</div>
						<NuxtLink
							v-if="moreReviews"
							class="bd-btn bd-btn--ghost reviews__more"
							:to="{ query: { reviews: (data.reviewLimit ?? 10) + 10 }, hash: '#reviews' }"
						>
							Show more reviews
						</NuxtLink>
					</template>
					<p v-else class="reviews__none">No reviews yet.</p>
				</section>

				<ProductRail title="You may also like" :products="related" />
				<ProductRail title="Recently viewed" :products="recent" />
				<CompareBar />
			</template>
		</main>
		<BdFooter />
	</div>
</template>

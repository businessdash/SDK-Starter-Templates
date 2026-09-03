<script setup lang="ts">
/**
 * Newsletter signup — wired to BD followers via the browser-safe publishable
 * token. The SAME component powers the footer and the about section (mirroring
 * the DGP `SubscribeStub`), so a visitor sees one consistent signup everywhere.
 *
 * Why the core client (not a hook)? Vue has no `useFollowers` hook — only
 * React/Astro/Remix/T3 do. So we drive `createBdClient(...).followers`
 * directly and reimplement the per-browser "already subscribed" hint ourselves:
 * on a successful `join` we write `{ email, at }` to localStorage under
 * `bd.followers.<siteId>` and read it on mount, exactly like the React hook.
 *
 * Source of truth for "is this visitor subscribed": logged-in → `me(email)`
 * (authoritative, cross-device); anonymous → this per-browser flag. IP is
 * deliberately NOT used. The flag is just a privacy-friendly UX hint so an
 * anonymous visitor isn't shown the form forever; clearing storage re-shows it,
 * and re-subscribing is idempotent (no dupes).
 *
 * Graceful fallback: when the publishable token / site id aren't configured the
 * widget renders a "coming soon" placeholder with identical fields, so the page
 * never breaks in an unconfigured checkout. The token is browser-safe
 * (origin-locked, rate-limited, scoped `followers:self`).
 */
import { createBdClient } from "@businessdash/sdk";
import { computed, onMounted, ref } from "vue";

const props = withDefaults(
	defineProps<{
		/** Label shown above the email field. */
		label?: string;
		placeholder?: string;
		buttonLabel?: string;
		/** Distinguishes where a signup came from (e.g. "footer" / "about"). */
		source?: string;
		/** Unique id prefix so two instances on one page don't collide. */
		idPrefix?: string;
	}>(),
	{
		label: "Subscribe for updates",
		placeholder: "you@example.com",
		buttonLabel: "Subscribe",
		source: "subscribe",
		idPrefix: "subscribe",
	},
);

// Browser-exposed config. The publishable token + site id gate the live path;
// when either is missing we degrade to the placeholder. (`public.*` is inlined
// into the client bundle by Nuxt — these are intentionally browser-safe.)
const config = useRuntimeConfig();
const pk = config.public.bdPublicKey as string | undefined;
const siteId = config.public.bdSiteId as string | undefined;
const rawBaseUrl = config.public.bdPackageApiBaseUrl as string | undefined;
const followersEnabled = Boolean(pk && siteId);

/** The core client appends relative paths to `baseUrl`, so it must already end
 *  in `…/api/package/v1` (mirrors `server/utils/bd.ts#normalizeBaseUrl`). */
function normalizeBaseUrl(input: string): string {
	const next = input.trim().replace(/\/+$/, "");
	if (next.endsWith("/api/package/v1")) return next;
	return `${next}/api/package/v1`;
}

const STORE_PREFIX = "bd.followers.";
const storeKey = computed(() => `${STORE_PREFIX}${siteId ?? ""}`);

type Status = "idle" | "submitting" | "done" | "error";
const status = ref<Status>("idle");
// Per-browser "already subscribed" hint (read on mount; SSR starts false so the
// form renders, then hydration reconciles to the stored value).
const subscribedLocally = ref(false);

onMounted(() => {
	if (typeof window === "undefined") return;
	try {
		const raw = window.localStorage.getItem(storeKey.value);
		subscribedLocally.value = Boolean(
			raw && typeof (JSON.parse(raw) as { email?: unknown }).email === "string",
		);
	} catch {
		subscribedLocally.value = false;
	}
});

function writeLocalFollow(email: string) {
	if (typeof window === "undefined") return;
	try {
		window.localStorage.setItem(
			storeKey.value,
			JSON.stringify({ email, at: Date.now() }),
		);
	} catch {
		// storage disabled / quota — the local hint is best-effort.
	}
}

// Built lazily so the placeholder path never instantiates a client.
let client: ReturnType<typeof createBdClient> | null = null;
function getClient() {
	if (client) return client;
	client = createBdClient({
		apiKey: pk as string,
		siteId: siteId as string,
		baseUrl: normalizeBaseUrl(rawBaseUrl || "https://www.biab.app"),
	});
	return client;
}

async function onSubmit(event: Event) {
	event.preventDefault();
	const form = event.currentTarget as HTMLFormElement;
	const email = String(new FormData(form).get("email") ?? "").trim();
	if (!email) return;

	// Placeholder mode: same fields, just confirm "coming soon".
	if (!followersEnabled) {
		status.value = "done";
		return;
	}

	status.value = "submitting";
	try {
		await getClient().followers.join({ email, source: props.source });
		writeLocalFollow(email);
		status.value = "done";
	} catch {
		status.value = "error";
	}
}

// Anonymous "already subscribed" hint, or a fresh success.
const showSubscribed = computed(
	() => subscribedLocally.value || status.value === "done",
);
const subscribedMessage = computed(() =>
	followersEnabled
		? "You're subscribed — thanks!"
		: "Thanks — newsletter signup is coming soon.",
);
</script>

<template>
	<p v-if="showSubscribed" class="subscribe__done">{{ subscribedMessage }}</p>
	<form v-else class="subscribe" @submit="onSubmit">
		<label class="bd-label subscribe__label" :for="`${idPrefix}-email`">
			{{ label }}
		</label>
		<div class="subscribe__row">
			<input
				:id="`${idPrefix}-email`"
				autocomplete="email"
				class="bd-input subscribe__input"
				:disabled="status === 'submitting'"
				name="email"
				:placeholder="placeholder"
				required
				type="email"
			/>
			<button
				class="bd-btn subscribe__btn"
				:disabled="status === 'submitting'"
				type="submit"
			>
				{{ status === "submitting" ? "Joining…" : buttonLabel }}
			</button>
		</div>
		<p v-if="status === 'error'" class="subscribe__error">
			Couldn't subscribe — please try again.
		</p>
	</form>
</template>

<style scoped>
.subscribe {
	display: flex;
	flex-direction: column;
	gap: 0.5rem;
	max-width: 26rem;
}

.subscribe__row {
	display: flex;
	gap: 0.5rem;
	align-items: stretch;
}

.subscribe__input {
	flex: 1;
	min-width: 0;
}

.subscribe__btn {
	white-space: nowrap;
}

.subscribe__done {
	color: var(--success);
	font-size: 0.9rem;
}

.subscribe__error {
	color: var(--danger);
	font-size: 0.85rem;
}
</style>

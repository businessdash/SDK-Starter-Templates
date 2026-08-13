// https://nuxt.com/docs/api/configuration/nuxt-config
export default defineNuxtConfig({
	compatibilityDate: "2025-07-15",
	devtools: { enabled: true },
	/**
	 * Global stylesheets. `biab-tokens.css` is the site's own theme; the SDK's
	 * `biab-forms.css` styles the `<BiabForm>` internals the tokens can't reach —
	 * the file-upload box, the multi-step progress header (steps + bar), and the
	 * availability/choice chips. Those are unstyled without it. The SDK omits the
	 * form container background on purpose (it's transparent) so the template owns
	 * the surface; don't add one in the SDK layer.
	 */
	css: ["~/assets/css/biab-tokens.css", "@businessdash/sdk/biab-forms.css"],
	/**
	 * `@businessdash/sdk/vue` ships its `<BiabForm>` binding as raw source (a `.vue`
	 * SFC + `.ts`), so Nuxt must run it through its own Vue/Vite pipeline rather
	 * than treating it as a pre-built node_modules dependency. `build.transpile`
	 * is what makes Nuxt compile the SFC; `optimizeDeps.exclude` keeps Vite's
	 * dep-pre-bundler from grabbing the `.vue` before `@vitejs/plugin-vue` does.
	 */
	build: { transpile: ["@businessdash/sdk"] },
	vite: { optimizeDeps: { exclude: ["@businessdash/sdk"] } },
	/**
	 * BIAB env, consolidated here — the one idiomatic place Nuxt centralizes
	 * env, so the whole app reads it through `useRuntimeConfig()`. Each key
	 * prefers the canonical name shipped in `.env.example` (matching the T3
	 * starter + the SDK) and falls back to this starter's original `NUXT_*`
	 * name, so existing `.env` files keep working. The `??` chains capture the
	 * value from `.env` when the config loads; the `NUXT_*` twins additionally
	 * override at runtime (Nitro's built-in `runtimeConfig` env mapping).
	 * Server-only keys stay OUT of `public`, so the bearer key + secrets never
	 * reach the client bundle.
	 */
	runtimeConfig: {
		// Secret API key (`sk_…`) — server-only, never exposed to the browser.
		biabApiKey: process.env.BIAB_API_KEY ?? process.env.NUXT_BIAB_API_KEY ?? "",
		biabSiteId:
			process.env.NUXT_PUBLIC_BIAB_SITE_ID ??
			process.env.NUXT_BIAB_SITE_ID ??
			"",
		biabPackageApiBaseUrl:
			process.env.NUXT_PUBLIC_BIAB_PACKAGE_API_BASE_URL ??
			process.env.NUXT_BIAB_PACKAGE_API_BASE_URL ??
			"https://www.biab.app",
		// HMAC secret (`whsec_…`) for the revalidate webhook — server-only.
		biabRevalidationSecret:
			process.env.BIAB_REVALIDATION_SECRET ??
			process.env.NUXT_BIAB_REVALIDATION_SECRET ??
			"",
		// Public, fully-qualified URL of the auth handler's /callback route.
		// Required for sign-in / sign-up / customer portal.
		biabAuthCallbackUrl:
			process.env.BIAB_AUTH_CALLBACK_URL ??
			process.env.NUXT_BIAB_AUTH_CALLBACK_URL ??
			"",
		/**
		 * Browser-exposed config. Unlike the keys above, `public.*` IS inlined into
		 * the client bundle — so only ever put browser-SAFE values here. The
		 * publishable token (`pk_…`) is origin-locked + rate-limited and scoped to
		 * `followers:self`, so it's safe to ship: it powers the newsletter Subscribe
		 * widget (followers) and the visitor analytics tracker (`app/app.vue`).
		 */
		public: {
			biabPublicKey:
				process.env.NUXT_PUBLIC_BIAB_PK ??
				process.env.NUXT_PUBLIC_BIAB_PUBLIC_KEY ??
				"",
			biabSiteId:
				process.env.NUXT_PUBLIC_BIAB_SITE_ID ??
				process.env.NUXT_PUBLIC_BIAB_SITE_ID ??
				"",
			biabPackageApiBaseUrl:
				process.env.NUXT_PUBLIC_BIAB_PACKAGE_API_BASE_URL ??
				process.env.NUXT_PUBLIC_BIAB_PACKAGE_API_BASE_URL ??
				"https://www.biab.app",
		},
	},
});

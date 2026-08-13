import { createEnv } from "@t3-oss/env-nextjs";
import { z } from "zod";

export const env = createEnv({
  /**
   * Specify your server-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars.
   */
  server: {
    // Optional: the BIAB Web Content SDK needs NO database. Set this only if you
    // use this starter's example tRPC/DB features. Accessing `db` without it
    // throws a helpful error (see src/server/db/index.ts) rather than crashing
    // the app at boot.
    DATABASE_URL: z.string().url().optional(),
    NODE_ENV: z
      .enum(["development", "test", "production"])
      .default("development"),
    BIAB_API_KEY: z.string().optional(),
    // Legacy fallbacks — prefer the NEXT_PUBLIC_ twins below (non-secret, and the
    // browser needs them). Kept optional so existing deployments don't break.
    BIAB_SITE_ID: z.string().uuid().optional(),
    BIAB_PACKAGE_API_BASE_URL: z.string().url().optional(),
    BIAB_REVALIDATION_SECRET: z.string().optional(),
    // Public URL of your auth handler's /callback route. Required for
    // sign-in / sign-up / customer portal. Register it as a WorkOS redirect URI.
    BIAB_AUTH_CALLBACK_URL: z.string().url().optional(),
  },

  /**
   * Specify your client-side environment variables schema here. This way you can ensure the app
   * isn't built with invalid env vars. To expose them to the client, prefix them with
   * `NEXT_PUBLIC_`.
   */
  client: {
    // Production origin used in server-side JSON-LD (LocalBusiness / WebSite).
    // Falls back to https://example.com when unset.
    NEXT_PUBLIC_SITE_URL: z.string().url().optional(),
    // ── Browser-safe BIAB followers/subscribe credentials ──────────────
    // Publishable token (`pk_…`): origin-locked, rate-limited, scoped to
    // `followers:self` — safe to expose to the browser. Powers the newsletter
    // signup. When PK + SITE_ID are unset the Subscribe component degrades to a
    // "coming soon" placeholder so the template still runs unconfigured.
    NEXT_PUBLIC_BIAB_PK: z.string().optional(),
    NEXT_PUBLIC_BIAB_SITE_ID: z.string().uuid().optional(),
    NEXT_PUBLIC_BIAB_PACKAGE_API_BASE_URL: z.string().url().optional(),
    // NEXT_PUBLIC_CLIENTVAR: z.string(),
  },

  /**
   * You can't destruct `process.env` as a regular object in the Next.js edge runtimes (e.g.
   * middlewares) or client-side so we need to destruct manually.
   */
  runtimeEnv: {
    DATABASE_URL: process.env.DATABASE_URL,
    NODE_ENV: process.env.NODE_ENV,
    BIAB_API_KEY: process.env.BIAB_API_KEY,
    BIAB_SITE_ID: process.env.BIAB_SITE_ID,
    BIAB_PACKAGE_API_BASE_URL: process.env.BIAB_PACKAGE_API_BASE_URL,
    BIAB_REVALIDATION_SECRET: process.env.BIAB_REVALIDATION_SECRET,
    BIAB_AUTH_CALLBACK_URL: process.env.BIAB_AUTH_CALLBACK_URL,
    NEXT_PUBLIC_SITE_URL: process.env.NEXT_PUBLIC_SITE_URL,
    NEXT_PUBLIC_BIAB_PK: process.env.NEXT_PUBLIC_BIAB_PK,
    NEXT_PUBLIC_BIAB_SITE_ID: process.env.NEXT_PUBLIC_BIAB_SITE_ID,
    NEXT_PUBLIC_BIAB_PACKAGE_API_BASE_URL:
      process.env.NEXT_PUBLIC_BIAB_PACKAGE_API_BASE_URL,
    // NEXT_PUBLIC_CLIENTVAR: process.env.NEXT_PUBLIC_CLIENTVAR,
  },
  /**
   * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially
   * useful for Docker builds.
   */
  skipValidation: !!process.env.SKIP_ENV_VALIDATION,
  /**
   * Makes it so that empty strings are treated as undefined. `SOME_VAR: z.string()` and
   * `SOME_VAR=''` will throw an error.
   */
  emptyStringAsUndefined: true,
});

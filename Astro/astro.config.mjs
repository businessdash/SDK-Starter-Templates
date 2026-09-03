// @ts-check
import node from "@astrojs/node";
import { defineConfig } from "astro/config";

// https://astro.build/config
export default defineConfig({
	// Server-rendered pages so the BD SDK can be called during
	// render. The Node adapter is the most portable choice for a
	// starter — swap for `@astrojs/vercel`, `@astrojs/cloudflare`,
	// or `@astrojs/netlify` to deploy elsewhere.
	output: "server",
	adapter: node({ mode: "standalone" }),
});

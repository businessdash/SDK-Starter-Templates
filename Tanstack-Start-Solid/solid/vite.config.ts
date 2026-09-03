import tailwindcss from "@tailwindcss/vite";
import { devtools } from "@tanstack/devtools-vite";
import { tanstackStart } from "@tanstack/solid-start/plugin/vite";
import { nitro } from "nitro/vite";
import { defineConfig } from "vite";
import solidPlugin from "vite-plugin-solid";

export default defineConfig({
	resolve: { tsconfigPaths: true },
	// Expose both prefixes to the browser bundle: VITE_ (the Vite default) and
	// VITE_ (the canonical names the BD wizard emits). Only non-secret
	// browser-safe vars ever carry these prefixes — the secret BD_API_KEY never
	// does, so it stays server-only.
	envPrefix: ["VITE_"],
	plugins: [
		devtools(),
		nitro(),
		tailwindcss(),
		tanstackStart(),
		solidPlugin({ ssr: true }),
	],
});

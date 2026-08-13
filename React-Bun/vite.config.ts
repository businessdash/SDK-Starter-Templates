import { defineConfig } from "vite";
import react from "@vitejs/plugin-react";

// https://vite.dev/config/
export default defineConfig({
	plugins: [react()],
	// Expose both prefixes to the browser bundle: VITE_ (the Vite default) and
	// VITE_ (the canonical names the BIAB wizard emits). Only non-secret
	// browser-safe vars ever carry these prefixes — the secret BIAB_API_KEY never
	// does, so it stays server-only.
	envPrefix: ["VITE_"],
	server: {
		// Dev only: Vite serves the SPA on :5173 and forwards /api/biab/*
		// to the Bun proxy on :3000 so the browser only ever talks to
		// same-origin and the BIAB key never enters the browser bundle.
		proxy: {
			"/api/biab": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
			// Auth handler, sitemap, and robots are also served by the Bun
			// proxy (the key-holder). Forward them in dev too.
			"/api/biab-auth": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
			"/sitemap.xml": { target: "http://localhost:3000", changeOrigin: true },
			"/robots.txt": { target: "http://localhost:3000", changeOrigin: true },
			// AEO + MCP surfaces also live on the Bun proxy (the key-holder).
			"/llms.txt": { target: "http://localhost:3000", changeOrigin: true },
			"/api/mcp": { target: "http://localhost:3000", changeOrigin: true },
			"/.well-known": { target: "http://localhost:3000", changeOrigin: true },
			"/ai/product-feed": {
				target: "http://localhost:3000",
				changeOrigin: true,
			},
		},
	},
});

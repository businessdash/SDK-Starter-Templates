import { RenderMode, ServerRoute } from "@angular/ssr";

/**
 * Server render config. These routes read live BD data per request (cart,
 * account, store, programmatic pages), so they render on the server at request
 * time rather than being prerendered at build time. The home page is server-
 * rendered too so the JSON-LD head injection (see src/server.ts) runs.
 */
export const serverRoutes: ServerRoute[] = [
	{
		path: "**",
		renderMode: RenderMode.Server,
	},
];

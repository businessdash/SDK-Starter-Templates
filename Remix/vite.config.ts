import { reactRouter } from "@react-router/dev/vite";
import { defineConfig } from "vite";
import tsconfigPaths from "vite-tsconfig-paths";

export default defineConfig({
	plugins: [
		// React Router 7 framework mode — the successor to the Remix vite
		// plugin. The old v3_* future flags are RR7's defaults, so they're gone.
		reactRouter(),
		// `ignoreConfigErrors` so the plugin skips any unrelated/broken
		// tsconfig it discovers while walking the directory tree (e.g. when the
		// template lives inside a larger monorepo with sibling projects) instead
		// of aborting the build. Only this template's own paths are resolved.
		tsconfigPaths({ ignoreConfigErrors: true }),
	],
});

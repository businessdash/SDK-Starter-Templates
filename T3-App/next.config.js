/**
 * Run `build` or `dev` with `SKIP_ENV_VALIDATION` to skip env validation. This is especially useful
 * for Docker builds.
 */
import { fileURLToPath } from "node:url";

import "./src/env.js";

/** @type {import("next").NextConfig} */
const config = {
  // This starter installs its own deps (own lockfile), but lives inside a
  // larger monorepo during development. Pin the file-tracing root to this
  // directory so Next doesn't infer the outer workspace root.
  outputFileTracingRoot: fileURLToPath(new URL(".", import.meta.url)),
};

export default config;

import { flatRoutes } from "@react-router/fs-routes";
import type { RouteConfig } from "@react-router/dev/routes";

/**
 * Keep Remix's flat-file route convention (`store.$id.tsx`,
 * `[.well-known].[mcp.json].ts`, …) — `flatRoutes()` reads the same
 * `app/routes/` directory with the same naming rules RR7 inherited.
 */
export default flatRoutes() satisfies RouteConfig;

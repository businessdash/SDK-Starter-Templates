import { type Config } from "drizzle-kit";

import { env } from "@/env";

export default {
  schema: "./src/server/db/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    // DATABASE_URL is optional in env.js (the starter runs without a DB until
    // you add one) but drizzle-kit's Config requires a string — running any
    // db:* script without it set should fail THERE, loudly, not here.
    url: env.DATABASE_URL ?? "postgres://set-DATABASE_URL-in-.env/db",
  },
  tablesFilter: ["T3-App_*"],
} satisfies Config;

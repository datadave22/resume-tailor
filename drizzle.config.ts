import { defineConfig } from "drizzle-kit";
import env from "./config/env.js";

export default defineConfig({
  out: "./migrations",
  schema: "./shared/schema.ts",
  dialect: "postgresql",
  dbCredentials: {
    url: env.database.url,
  },
});

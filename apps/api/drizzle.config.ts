import { defineConfig } from "drizzle-kit";
import { join } from "path";

export default defineConfig({
  schema: "./src/db/schema.ts",
  out: "./drizzle",
  dialect: "sqlite",
  dbCredentials: {
    url: join(process.cwd(), "data", "archispark.db"),
  },
});

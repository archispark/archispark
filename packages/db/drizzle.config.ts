import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "url";

const driver = (process.env["DB_DRIVER"] ?? "sqlite") as "sqlite" | "postgres";

export default defineConfig(
  driver === "postgres"
    ? {
        schema: "./src/schema-pg.ts",
        out: "./drizzle-pg",
        dialect: "postgresql",
        dbCredentials: {
          url: process.env["DATABASE_URL"] ?? "postgresql://archispark:archispark@localhost:5432/archispark",
        },
      }
    : {
        schema: "./src/schema.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: {
          url: fileURLToPath(new URL("../../data/archispark.db", import.meta.url)),
        },
      }
);

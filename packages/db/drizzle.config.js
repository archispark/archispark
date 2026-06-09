import { defineConfig } from "drizzle-kit";
import { fileURLToPath } from "url";
const driver = (process.env["DB_DRIVER"] ?? "sqlite");
if (driver === "postgres" && !process.env["DATABASE_URL"])
    throw new Error("DATABASE_URL is required when DB_DRIVER=postgres");
export default defineConfig(driver === "postgres"
    ? {
        schema: "./src/schema-pg.ts",
        out: "./drizzle-pg",
        dialect: "postgresql",
        dbCredentials: {
            url: process.env["DATABASE_URL"],
        },
    }
    : {
        schema: "./src/schema.ts",
        out: "./drizzle",
        dialect: "sqlite",
        dbCredentials: {
            url: fileURLToPath(new URL("../../data/archispark.db", import.meta.url)),
        },
    });

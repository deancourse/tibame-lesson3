import dotenv from "dotenv";
import { dirname, resolve } from "node:path";
import { fileURLToPath } from "node:url";
import { defineConfig, env } from "prisma/config";

const __dirname = dirname(fileURLToPath(import.meta.url));

dotenv.config({ path: resolve(__dirname, "../../.env") });

export default defineConfig({
  schema: resolve(__dirname, "prisma/schema.prisma"),
  migrations: {
    path: resolve(__dirname, "prisma/migrations"),
  },
  datasource: {
    url: env("DATABASE_URL"),
  },
});

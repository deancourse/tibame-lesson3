import path from "node:path";
import dotenv from "dotenv";
import { defineConfig, env } from "prisma/config";

// 與 src/lib/loadDotenv.ts 相同：所有 prisma CLI 指令的 cwd 都是 apps/api，
// 因此 ../../.env 一律指向 repo 根目錄。已存在的環境變數（如測試腳本注入的
// DATABASE_URL）不會被 .env 覆寫。
dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });

export default defineConfig({
  schema: "prisma/schema.prisma",
  migrations: {
    path: "prisma/migrations",
  },
  datasource: {
    // Prisma 7 起 datasource url 從 schema.prisma 移到這裡（lazy 解析，
    // 不需要 DB 的指令如 generate 不會因缺少環境變數而失敗）。
    url: env("DATABASE_URL"),
  },
});

import dotenv from "dotenv";
import path from "node:path";

// jest setupFiles：在每個測試檔案載入 app/prisma 之前執行，
// 把 DATABASE_URL 覆寫成 TEST_DATABASE_URL，讓測試跑在獨立的 vms_test DB 上，
// 不會動到 apps/api/src/lib/loadDotenv.ts 載入的開發 DB。
dotenv.config({ path: path.resolve(process.cwd(), "../../.env") });

if (!process.env.TEST_DATABASE_URL) {
  throw new Error("TEST_DATABASE_URL 未設定，請檢查根目錄 .env（並執行過 npm run db:migrate:test）");
}
process.env.DATABASE_URL = process.env.TEST_DATABASE_URL;

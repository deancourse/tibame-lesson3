// Jest setupFiles：在任何測試模組載入前，把 DATABASE_URL 指向測試 DB。
// 這樣 PrismaClient（含直接跑單一測試檔的情境）一律連測試 DB，不會碰開發 DB。
import "../lib/loadDotenv.js";

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error("TEST_DATABASE_URL 未設定，請參考 .env.example 補上後再執行測試。");
}

const dbName = new URL(testUrl).pathname.slice(1);
if (!/test/i.test(dbName)) {
  throw new Error(`TEST_DATABASE_URL 的資料庫名稱「${dbName}」必須包含 "test"，避免誤砍開發資料庫。`);
}

process.env.DATABASE_URL = testUrl;

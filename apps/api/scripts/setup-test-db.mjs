// 重建測試 DB：drop schema 後重套所有 migrations，確保每次 npm test 都是乾淨 schema。
// 由 pretest 自動執行；也可手動 `npm run db:test:reset`。
// 刻意不用 `prisma migrate reset`（互動式且對 AI agent 有額外防護），
// 改以 DROP SCHEMA + `prisma migrate deploy` 達成同樣效果。
import { spawnSync } from "node:child_process";
import path from "node:path";
import process from "node:process";
import dotenv from "dotenv";
import pg from "pg";

dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  console.error("TEST_DATABASE_URL 未設定，請參考 .env.example 補上後再執行測試。");
  process.exit(1);
}

const dbName = new URL(testUrl).pathname.slice(1);
if (!/test/i.test(dbName) || !/^[a-zA-Z0-9_]+$/.test(dbName)) {
  console.error(
    `TEST_DATABASE_URL 的資料庫名稱「${dbName}」必須包含 "test"（且僅含英數與底線），避免誤砍開發資料庫。`
  );
  process.exit(1);
}

// Prisma 7 的 client 必須搭配 driver adapter，腳本改用 pg 直連最單純。
async function withClient(url, fn) {
  const client = new pg.Client({ connectionString: url });
  await client.connect();
  try {
    return await fn(client);
  } finally {
    await client.end();
  }
}

// 1) 確保測試 DB 存在；存在則清空 schema，讓 migrate deploy 從零重建。
try {
  await withClient(testUrl, async (db) => {
    await db.query("DROP SCHEMA IF EXISTS public CASCADE");
    await db.query("CREATE SCHEMA public");
  });
} catch (err) {
  // 3D000 = invalid_catalog_name（資料庫不存在）
  if (err?.code === "3D000" || /does not exist/.test(String(err?.message))) {
    // 測試 DB 還不存在 → 連開發 DB 建立它（CREATE DATABASE 無法在目標 DB 上執行）。
    await withClient(process.env.DATABASE_URL, (admin) =>
      admin.query(`CREATE DATABASE "${dbName}"`),
    );
  } else {
    throw err;
  }
}

// 2) 套用所有 migrations（非破壞性，與正式 schema 流程一致）。
const result = spawnSync("npx", ["prisma", "migrate", "deploy"], {
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});
process.exit(result.status ?? 1);

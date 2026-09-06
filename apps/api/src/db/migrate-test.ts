import "../lib/loadDotenv.js";
import { execSync } from "node:child_process";
import path from "node:path";

// 建立（若不存在）並套用 migration 到 apps/api 測試專用的 TEST_DATABASE_URL，
// 讓 jest 測試（見 src/test/env.setup.ts）跑在與開發 DB 分離的 database 上。
// 首次使用，或新增 prisma migration 後，重跑本指令（npm run db:migrate:test）即可同步。

const testUrl = process.env.TEST_DATABASE_URL;
if (!testUrl) {
  throw new Error("TEST_DATABASE_URL 未設定，請檢查根目錄 .env");
}

const dbName = new URL(testUrl).pathname.replace(/^\//, "");
if (!dbName) {
  throw new Error(`TEST_DATABASE_URL 解析不出 database 名稱: ${testUrl}`);
}

const repoRoot = path.resolve(process.cwd(), "../..");

try {
  execSync(`docker compose exec -T db psql -U vms -d postgres -c "CREATE DATABASE ${dbName}"`, {
    cwd: repoRoot,
    stdio: "pipe",
  });
  console.log(`migrate-test: 已建立 database '${dbName}'`);
} catch (err) {
  const stderr = (err as { stderr?: Buffer }).stderr?.toString() ?? "";
  if (stderr.includes("already exists")) {
    console.log(`migrate-test: database '${dbName}' 已存在，略過建立`);
  } else {
    console.error(stderr || err);
    throw new Error(`migrate-test: 建立 database '${dbName}' 失敗，請確認 \`docker compose up -d\` 已啟動`);
  }
}

console.log(`migrate-test: 套用 migration 到 '${dbName}'...`);
execSync("npx prisma migrate deploy", {
  cwd: process.cwd(),
  stdio: "inherit",
  env: { ...process.env, DATABASE_URL: testUrl },
});
console.log("migrate-test: 完成");

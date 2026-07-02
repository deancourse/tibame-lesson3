import { spawnSync } from "node:child_process";
import path from "node:path";
import { fileURLToPath } from "node:url";
import dotenv from "dotenv";

const scriptDir = path.dirname(fileURLToPath(import.meta.url));
const apiRoot = path.resolve(scriptDir, "..");
const repoRoot = path.resolve(apiRoot, "../..");
const prismaCli = path.join(repoRoot, "node_modules", "prisma", "build", "index.js");

function required(name) {
  const value = process.env[name];
  if (!value) {
    throw new Error(`環境變數 ${name} 未設定；API 測試必須使用獨立 TestDB。`);
  }
  return value;
}

function parseDatabaseUrl(name, value) {
  let url;
  try {
    url = new URL(value);
  } catch {
    throw new Error(`環境變數 ${name} 不是有效的 PostgreSQL URL。`);
  }

  if (url.protocol !== "postgresql:" && url.protocol !== "postgres:") {
    throw new Error(`環境變數 ${name} 必須使用 postgresql:// 或 postgres://。`);
  }

  const databaseName = decodeURIComponent(url.pathname.replace(/^\/+/, ""));
  if (!databaseName) {
    throw new Error(`環境變數 ${name} 必須包含 database 名稱。`);
  }

  const port = url.port || "5432";
  const identity = `${url.protocol}//${url.hostname}:${port}/${databaseName}`;
  const maintenanceUrl = new URL(url.toString());
  maintenanceUrl.pathname = "/postgres";
  maintenanceUrl.searchParams.delete("schema");

  return {
    databaseName,
    identity,
    maintenanceUrl: maintenanceUrl.toString(),
  };
}

function quotePgIdentifier(value) {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

function resolveTestDatabaseEnv() {
  dotenv.config({ path: path.join(repoRoot, ".env") });

  const databaseUrl = required("DATABASE_URL");
  const testDatabaseUrl = required("TEST_DATABASE_URL");
  const dev = parseDatabaseUrl("DATABASE_URL", databaseUrl);
  const test = parseDatabaseUrl("TEST_DATABASE_URL", testDatabaseUrl);

  if (dev.identity === test.identity || dev.databaseName === test.databaseName) {
    throw new Error("TEST_DATABASE_URL 不可與 DATABASE_URL 指向同一個 database，避免測試清掉開發資料。");
  }

  process.env.NODE_ENV = "test";
  process.env.DATABASE_URL = testDatabaseUrl;

  return {
    testDatabaseUrl,
    testDatabaseName: test.databaseName,
    maintenanceDatabaseUrl: test.maintenanceUrl,
  };
}

function runPrisma(args, options = {}) {
  const result = spawnSync(process.execPath, [prismaCli, ...args], {
    cwd: apiRoot,
    env: process.env,
    input: options.input,
    encoding: options.input ? "utf8" : undefined,
    stdio: options.inherit ? "inherit" : "pipe",
  });

  if (result.error) {
    throw result.error;
  }

  return {
    status: result.status ?? 1,
    stdout: typeof result.stdout === "string" ? result.stdout : "",
    stderr: typeof result.stderr === "string" ? result.stderr : "",
  };
}

function ensureTestDatabase(databaseName, maintenanceDatabaseUrl) {
  const sql = `CREATE DATABASE ${quotePgIdentifier(databaseName)};`;
  const result = runPrisma(["db", "execute", "--stdin", "--url", maintenanceDatabaseUrl], { input: sql });
  const output = `${result.stdout}\n${result.stderr}`;

  if (result.status === 0) {
    return;
  }

  if (output.includes("already exists") || output.includes("42P04")) {
    return;
  }

  throw new Error(`建立 TestDB 失敗：\n${output.trim()}`);
}

function resetTestDatabase() {
  const result = runPrisma(["migrate", "reset", "--force", "--skip-seed", "--skip-generate"], { inherit: true });
  if (result.status !== 0) {
    process.exit(result.status);
  }
}

const { maintenanceDatabaseUrl, testDatabaseName } = resolveTestDatabaseEnv();

ensureTestDatabase(testDatabaseName, maintenanceDatabaseUrl);
resetTestDatabase();
console.log(`TestDB '${testDatabaseName}' is ready.`);

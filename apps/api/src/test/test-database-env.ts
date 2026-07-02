import dotenv from "dotenv";
import path from "node:path";
import { fileURLToPath } from "node:url";

const fileDir = path.dirname(fileURLToPath(import.meta.url));

export const apiRoot = path.resolve(fileDir, "../..");
export const repoRoot = path.resolve(apiRoot, "../..");

type ParsedDatabaseUrl = {
  databaseName: string;
  identity: string;
  maintenanceUrl: string;
};

function requiredValue(name: string, value: string | undefined): string {
  if (!value) {
    throw new Error(`環境變數 ${name} 未設定；API 測試必須使用獨立 TestDB。`);
  }
  return value;
}

function parseDatabaseUrl(name: string, value: string): ParsedDatabaseUrl {
  let url: URL;
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

export function quotePgIdentifier(value: string): string {
  return `"${value.replaceAll("\"", "\"\"")}"`;
}

export function resolveTestDatabaseConfig(databaseUrlValue: string | undefined, testDatabaseUrlValue: string | undefined) {
  const databaseUrl = requiredValue("DATABASE_URL", databaseUrlValue);
  const testDatabaseUrl = requiredValue("TEST_DATABASE_URL", testDatabaseUrlValue);
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

export function resolveTestDatabaseEnv() {
  dotenv.config({ path: path.join(repoRoot, ".env") });

  return resolveTestDatabaseConfig(process.env.DATABASE_URL, process.env.TEST_DATABASE_URL);
}

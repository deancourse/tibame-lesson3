import { resolveTestDatabaseConfig } from "./test-database-env.js";

describe("resolveTestDatabaseConfig", () => {
  const devUrl = "postgresql://vms:vms@localhost:5432/vms?schema=public";
  const testUrl = "postgresql://vms:vms@localhost:5432/vms_test?schema=public";

  it("requires TEST_DATABASE_URL", () => {
    expect(() => resolveTestDatabaseConfig(devUrl, undefined)).toThrow("TEST_DATABASE_URL");
  });

  it("rejects same database name even when host differs", () => {
    const aliasedDevDbUrl = "postgresql://vms:vms@127.0.0.1:5432/vms?schema=public";

    expect(() => resolveTestDatabaseConfig(devUrl, aliasedDevDbUrl)).toThrow("不可與 DATABASE_URL 指向同一個 database");
  });

  it("returns TestDB connection metadata for an isolated database", () => {
    const config = resolveTestDatabaseConfig(devUrl, testUrl);

    expect(config.testDatabaseUrl).toBe(testUrl);
    expect(config.testDatabaseName).toBe("vms_test");
    expect(config.maintenanceDatabaseUrl).toBe("postgresql://vms:vms@localhost:5432/postgres");
  });
});

// 測試案例來源:doc/test/backend/login.md
import request from "supertest";
import { buildApp } from "../app.js";
import { prisma } from "../db/prisma.js";
import { disconnect, resetDb } from "../test/setup.js";
import { makeEmployee } from "../test/factories.js";
import { loginAs } from "../test/helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnect();
});

describe("登入(POST /api/auth/login)", () => {
  describe("API 整合", () => {
    test("成功登入回傳 user 與 csrfToken,並設置 httpOnly cookie", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.user).toEqual({
        id: emp.id,
        name: emp.name,
        role: "USER",
        employeeId: emp.id,
        email: emp.email,
      });
      expect(res.body.csrfToken).toEqual(expect.any(String));
      const cookie = res.headers["set-cookie"]?.[0];
      expect(cookie).toMatch(/vms_token=/);
      expect(cookie).toMatch(/HttpOnly/i);
    });

    test("帳號不存在回傳 401 INVALID_CREDENTIALS", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "no-such-user", password: "whatever" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      expect(res.body.error.message).toBe("帳號或密碼錯誤");
    });

    test("密碼錯誤回傳 401 INVALID_CREDENTIALS,且 failedLoginCount +1", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "wrong" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      const after = await prisma.employee.findUnique({ where: { id: emp.id } });
      expect(after?.failedLoginCount).toBe(1);
      expect(after?.lockedUntil).toBeNull();
    });

    test("成功登入會重置 failedLoginCount 與 lockedUntil", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      await prisma.employee.update({
        where: { id: emp.id },
        data: { failedLoginCount: 2 },
      });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(200);
      const after = await prisma.employee.findUnique({ where: { id: emp.id } });
      expect(after?.failedLoginCount).toBe(0);
      expect(after?.lockedUntil).toBeNull();
    });

    test("INACTIVE 帳號無法登入,回傳 401 ACCOUNT_INACTIVE", async () => {
      await makeEmployee({ username: "alice", password: "password123", status: "INACTIVE" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");
      expect(res.body.error.message).toBe("帳號已停用");
      expect(res.headers["set-cookie"]).toBeUndefined();
    });
  });

  describe("輸入驗證", () => {
    test("缺少 username 或 password 回傳 400 VALIDATION_ERROR", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
      expect(res.body.error.details.fieldErrors.password).toBeDefined();
    });
  });

  describe("帳號鎖定", () => {
    test("連續 5 次密碼錯誤後帳號鎖定 15 分鐘", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      for (let i = 0; i < 5; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ username: "alice", password: "wrong" });
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      }
      const after = await prisma.employee.findUnique({ where: { id: emp.id } });
      expect(after?.failedLoginCount).toBe(5);
      const remainingMs = after!.lockedUntil!.getTime() - Date.now();
      expect(remainingMs).toBeGreaterThan(14 * 60 * 1000);
      expect(remainingMs).toBeLessThanOrEqual(15 * 60 * 1000);

      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "anything" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
      expect(res.body.error.details.unlockAt).toBe(after!.lockedUntil!.toISOString());
    });

    test("鎖定期間即使密碼正確仍回傳 ACCOUNT_LOCKED", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      await prisma.employee.update({
        where: { id: emp.id },
        data: { failedLoginCount: 5, lockedUntil: new Date(Date.now() + 60_000) },
      });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
      expect(res.headers["set-cookie"]).toBeUndefined();
      const after = await prisma.employee.findUnique({ where: { id: emp.id } });
      expect(after?.failedLoginCount).toBe(5);
    });

    test("鎖定到期後可重新登入", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      await prisma.employee.update({
        where: { id: emp.id },
        data: { failedLoginCount: 5, lockedUntil: new Date(Date.now() - 1000) },
      });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(200);
      const after = await prisma.employee.findUnique({ where: { id: emp.id } });
      expect(after?.failedLoginCount).toBe(0);
      expect(after?.lockedUntil).toBeNull();
    });
  });

  describe("驗證權限", () => {
    test("POST /api/auth/login 不受 csrfGuard 攔截", async () => {
      await makeEmployee({ username: "alice", password: "password123" });
      const session = await loginAs(app, "alice");
      // 帶著舊 cookie、不帶 X-CSRF-Token 再次登入,不應被 csrfGuard 以 403 擋下
      const res = await request(app)
        .post("/api/auth/login")
        .set("Cookie", session.cookies)
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(200);
    });
  });

  describe("function 邏輯", () => {
    test("回傳的 csrfToken 可通過後續 mutating 請求的 CSRF 驗證", async () => {
      await makeEmployee({ username: "alice", password: "password123" });
      const session = await loginAs(app, "alice");
      const tampered = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", session.cookies)
        .set("X-CSRF-Token", "tampered-token");
      expect(tampered.status).toBe(403);
      expect(tampered.body.error.code).toBe("CSRF_TOKEN_INVALID");

      const ok = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", session.cookies)
        .set("X-CSRF-Token", session.csrf);
      expect(ok.status).toBe(204);
    });
  });
});

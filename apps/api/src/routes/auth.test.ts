import request from "supertest";
import jwt from "jsonwebtoken";
import { buildApp } from "../app.js";
import { prisma } from "../db/prisma.js";
import { disconnect, resetDb } from "../test/setup.js";
import { makeEmployee } from "../test/factories.js";
import { loginAs } from "../test/helpers.js";
import { env } from "../lib/env.js";
import { AUTH_COOKIE } from "../lib/cookies.js";

const app = buildApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnect();
});

describe("auth", () => {
  describe("停用功能", () => {
    test("POST /api/auth/register 一律回傳 404", async () => {
      const res = await request(app).post("/api/auth/register").send({});
      expect(res.status).toBe(404);
    });
  });

  describe("成功登入", () => {
    test("正確帳密登入成功", async () => {
      await makeEmployee({ username: "alice", password: "password123" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(200);
      expect(res.body.user.role).toBe("USER");
      expect(res.body.user.passwordHash).toBeUndefined();
      expect(res.body.csrfToken).toEqual(expect.any(String));
      expect(res.headers["set-cookie"]?.[0]).toMatch(/HttpOnly/i);
    });

    test("登入成功會重置失敗計數與鎖定狀態", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      await prisma.employee.update({
        where: { id: emp.id },
        data: { failedLoginCount: 3 },
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

  describe("驗證失敗", () => {
    test("帳號不存在", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "nobody", password: "password123" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    test("密碼錯誤", async () => {
      await makeEmployee({ username: "alice", password: "password123" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "wrong" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
    });

    test("username 為空字串", async () => {
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "", password: "password123" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("password 為空字串", async () => {
      await makeEmployee({ username: "alice", password: "password123" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });

    test("缺少 username 或 password 欄位", async () => {
      const res = await request(app).post("/api/auth/login").send({ username: "alice" });
      expect(res.status).toBe(400);
      expect(res.body.error.code).toBe("VALIDATION_ERROR");
    });
  });

  describe("帳號鎖定", () => {
    test("連續 5 次密碼錯誤鎖定帳號 15 分鐘", async () => {
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
      expect(after?.lockedUntil?.getTime()).toBeGreaterThan(Date.now());

      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("ACCOUNT_LOCKED");
      expect(res.body.error.details.unlockAt).toEqual(expect.any(String));
    });

    test("未達 5 次失敗前不鎖定", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      for (let i = 0; i < 4; i++) {
        const res = await request(app)
          .post("/api/auth/login")
          .send({ username: "alice", password: "wrong" });
        expect(res.status).toBe(401);
        expect(res.body.error.code).toBe("INVALID_CREDENTIALS");
      }
      const midway = await prisma.employee.findUnique({ where: { id: emp.id } });
      expect(midway?.failedLoginCount).toBe(4);
      expect(midway?.lockedUntil).toBeNull();

      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(200);
    });

    test("鎖定期間即使密碼正確也拒絕，且不再累加失敗次數", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      const lockedUntil = new Date(Date.now() + 10 * 60 * 1000);
      await prisma.employee.update({
        where: { id: emp.id },
        data: { failedLoginCount: 5, lockedUntil },
      });

      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("ACCOUNT_LOCKED");

      const after = await prisma.employee.findUnique({ where: { id: emp.id } });
      expect(after?.failedLoginCount).toBe(5);
    });
  });

  describe("帳號停用", () => {
    test("INACTIVE 帳號無法登入", async () => {
      await makeEmployee({ username: "alice", password: "password123", status: "INACTIVE" });
      const res = await request(app)
        .post("/api/auth/login")
        .send({ username: "alice", password: "password123" });
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("ACCOUNT_INACTIVE");
    });
  });

  describe("查詢登入狀態", () => {
    test("GET /api/auth/me 未帶 cookie", async () => {
      const res = await request(app).get("/api/auth/me");
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    test("GET /api/auth/me 帶合法 cookie", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      const session = await loginAs(app, "alice");
      const res = await request(app).get("/api/auth/me").set("Cookie", session.cookies);
      expect(res.status).toBe(200);
      expect(res.body.user.email).toBe(emp.email);
    });

    // 重整後前端只剩 cookie（csrfToken 是純記憶體、不持久化）。/me 必須回傳可用的
    // csrfToken，否則登出請求會缺 CSRF token 被擋下，cookie 清不掉、仍能用網址進內頁。
    test("GET /api/auth/me 回傳的 csrfToken 可用於後續登出", async () => {
      await makeEmployee({ username: "alice", password: "password123" });
      const session = await loginAs(app, "alice");
      const me = await request(app).get("/api/auth/me").set("Cookie", session.cookies);
      expect(me.status).toBe(200);
      expect(me.body.csrfToken).toEqual(expect.any(String));
      const out = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", session.cookies)
        .set("X-CSRF-Token", me.body.csrfToken);
      expect(out.status).toBe(204);
    });

    test("GET /api/auth/me 對應員工已被刪除", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      const session = await loginAs(app, "alice");
      await prisma.employee.delete({ where: { id: emp.id } });
      const res = await request(app).get("/api/auth/me").set("Cookie", session.cookies);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("UNAUTHENTICATED");
    });

    test("GET /api/auth/me token 已過期", async () => {
      const emp = await makeEmployee({ username: "alice", password: "password123" });
      const expiredToken = jwt.sign(
        { sub: emp.id, role: emp.role, employeeId: emp.id, username: emp.username },
        env.JWT_SECRET,
        { algorithm: "HS256", expiresIn: "-10s" },
      );
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `${AUTH_COOKIE}=${expiredToken}`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("TOKEN_EXPIRED");
    });

    test("GET /api/auth/me token 不合法", async () => {
      const res = await request(app)
        .get("/api/auth/me")
        .set("Cookie", `${AUTH_COOKIE}=not-a-valid-jwt`);
      expect(res.status).toBe(401);
      expect(res.body.error.code).toBe("TOKEN_INVALID");
    });
  });

  describe("登出", () => {
    test("未帶 CSRF token", async () => {
      await makeEmployee({ username: "alice", password: "password123" });
      const session = await loginAs(app, "alice");
      const res = await request(app).post("/api/auth/logout").set("Cookie", session.cookies);
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("CSRF_TOKEN_MISSING");
    });

    test("帶錯誤的 CSRF token", async () => {
      await makeEmployee({ username: "alice", password: "password123" });
      const session = await loginAs(app, "alice");
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", session.cookies)
        .set("X-CSRF-Token", "wrong-token-value");
      expect(res.status).toBe(403);
      expect(res.body.error.code).toBe("CSRF_TOKEN_INVALID");
    });

    test("帶正確 CSRF token", async () => {
      await makeEmployee({ username: "alice", password: "password123" });
      const session = await loginAs(app, "alice");
      const res = await request(app)
        .post("/api/auth/logout")
        .set("Cookie", session.cookies)
        .set("X-CSRF-Token", session.csrf);
      expect(res.status).toBe(204);
    });
  });
});

import request from "supertest";
import { buildApp } from "../app.js";
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

// 登入(POST /api/auth/login)的案例已整併至 login.test.ts(對應 doc/test/backend/login.md)。
describe("auth", () => {
  test("POST /api/auth/register returns 404", async () => {
    const res = await request(app).post("/api/auth/register").send({});
    expect(res.status).toBe(404);
  });

  test("GET /api/auth/me without cookie -> 401", async () => {
    const res = await request(app).get("/api/auth/me");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  test("GET /api/auth/me with cookie -> 200", async () => {
    const emp = await makeEmployee({ username: "alice", password: "password123" });
    const session = await loginAs(app, "alice");
    const res = await request(app)
      .get("/api/auth/me")
      .set("Cookie", session.cookies);
    expect(res.status).toBe(200);
    expect(res.body.user.email).toBe(emp.email);
  });

  test("logout without csrf -> 403", async () => {
    await makeEmployee({ username: "alice", password: "password123" });
    const session = await loginAs(app, "alice");
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", session.cookies);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("CSRF_TOKEN_MISSING");
  });

  test("logout with csrf -> 204", async () => {
    await makeEmployee({ username: "alice", password: "password123" });
    const session = await loginAs(app, "alice");
    const res = await request(app)
      .post("/api/auth/logout")
      .set("Cookie", session.cookies)
      .set("X-CSRF-Token", session.csrf);
    expect(res.status).toBe(204);
  });

  // 重整後前端只剩 cookie（csrfToken 是純記憶體、不持久化）。/me 必須回傳可用的
  // csrfToken，否則登出請求會缺 CSRF token 被擋下，cookie 清不掉、仍能用網址進內頁。
  test("GET /api/auth/me returns a csrfToken that can be used to logout", async () => {
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
});

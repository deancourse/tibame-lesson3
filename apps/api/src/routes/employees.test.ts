import request from "supertest";
import { buildApp } from "../app.js";
import { prisma } from "../db/prisma.js";
import { disconnect, resetDb } from "../test/setup.js";
import { makeEmployee, makeVehicle } from "../test/factories.js";
import { loginAs, withAuth } from "../test/helpers.js";

const app = buildApp();

beforeEach(async () => {
  await resetDb();
});

afterAll(async () => {
  await disconnect();
});

describe("employees", () => {
  test("user GET /api/employees -> 403", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    await makeEmployee({ role: "USER", username: "user1" });
    const session = await loginAs(app, "user1");
    const res = await request(app)
      .get("/api/employees")
      .set("Cookie", session.cookies);
    expect(res.status).toBe(403);
    expect(res.body.error.code).toBe("FORBIDDEN");
  });

  test("unauthenticated -> 401", async () => {
    const res = await request(app).get("/api/employees");
    expect(res.status).toBe(401);
    expect(res.body.error.code).toBe("UNAUTHENTICATED");
  });

  test("DELETE /api/employees/:id -> 405", async () => {
    const admin = await makeEmployee({ role: "ADMIN", username: "admin1" });
    const session = await loginAs(app, "admin1");
    const res = await withAuth(
      request(app).delete(`/api/employees/${admin.id}`),
      session,
    );
    expect(res.status).toBe(405);
    expect(res.body.error.code).toBe("METHOD_NOT_ALLOWED");
  });

  test("admin POST creates employee, response excludes password", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const session = await loginAs(app, "admin1");
    const res = await withAuth(request(app).post("/api/employees"), session).send({
      employeeNo: "E-9001",
      name: "Bob",
      email: "bob@vms.local",
      department: "業務",
      position: "專員",
      hiredAt: "2025-01-01",
      phone: "0900-111-222",
      username: "bob",
      initialPassword: "password123",
      role: "USER",
    });
    expect(res.status).toBe(201);
    expect(res.body.passwordHash).toBeUndefined();
    expect(res.body.username).toBe("bob");
    const saved = await prisma.employee.findUnique({ where: { username: "bob" } });
    expect(saved?.passwordHash).not.toBe("password123");
  });

  test("duplicate username -> 409 with details.field", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const session = await loginAs(app, "admin1");
    const first = await withAuth(request(app).post("/api/employees"), session).send({
      employeeNo: "E-9001",
      name: "Bob",
      email: "bob@vms.local",
      department: "業務",
      position: "專員",
      hiredAt: "2025-01-01",
      phone: "0900-111-222",
      username: "bob",
      initialPassword: "password123",
    });
    expect({ status: first.status, body: first.body }).toMatchObject({ status: 201 });
    const dup = await withAuth(request(app).post("/api/employees"), session).send({
      employeeNo: "E-9002",
      name: "Bob2",
      email: "bob2@vms.local",
      department: "業務",
      position: "專員",
      hiredAt: "2025-01-01",
      phone: "0900-111-222",
      username: "bob",
      initialPassword: "password123",
    });
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("EMPLOYEE_CONFLICT");
    expect(dup.body.error.details.field).toBe("username");
  });

  test("admin cannot demote self", async () => {
    const admin = await makeEmployee({ role: "ADMIN", username: "admin1" });
    const session = await loginAs(app, "admin1");
    const res = await withAuth(
      request(app).patch(`/api/employees/${admin.id}`),
      session,
    ).send({ role: "USER" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("CANNOT_DEMOTE_SELF");
  });

  test("reset-password rejects short password", async () => {
    const admin = await makeEmployee({ role: "ADMIN", username: "admin1" });
    const session = await loginAs(app, "admin1");
    const res = await withAuth(
      request(app).post(`/api/employees/${admin.id}/reset-password`),
      session,
    ).send({ newPassword: "short" });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("reset-password clears lockout and counter", async () => {
    const admin = await makeEmployee({ role: "ADMIN", username: "admin1" });
    const target = await makeEmployee({
      role: "USER",
      username: "bob",
      password: "password123",
    });
    await prisma.employee.update({
      where: { id: target.id },
      data: { failedLoginCount: 3, lockedUntil: new Date(Date.now() + 60_000) },
    });
    const session = await loginAs(app, "admin1");
    const res = await withAuth(
      request(app).post(`/api/employees/${target.id}/reset-password`),
      session,
    ).send({ newPassword: "newpassword1" });
    expect(res.status).toBe(204);
    const after = await prisma.employee.findUnique({ where: { id: target.id } });
    expect(after?.failedLoginCount).toBe(0);
    expect(after?.lockedUntil).toBeNull();
  });

  test("setting INACTIVE preserves vehicle.ownerId", async () => {
    const admin = await makeEmployee({ role: "ADMIN", username: "admin1" });
    const owner = await makeEmployee({ role: "USER", username: "bob" });
    const car = await makeVehicle({ ownerId: owner.id });
    const session = await loginAs(app, "admin1");
    const res = await withAuth(
      request(app).patch(`/api/employees/${owner.id}`),
      session,
    ).send({ status: "INACTIVE" });
    expect(res.status).toBe(200);
    const after = await prisma.vehicle.findUnique({ where: { id: car.id } });
    expect(after?.ownerId).toBe(owner.id);
  });

  test("list default excludes INACTIVE", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    await makeEmployee({ role: "USER", username: "u-active" });
    await makeEmployee({ role: "USER", username: "u-inactive", status: "INACTIVE" });
    const session = await loginAs(app, "admin1");
    const res = await request(app)
      .get("/api/employees")
      .set("Cookie", session.cookies);
    expect(res.status).toBe(200);
    expect(res.body.items.every((e: { status: string }) => e.status === "ACTIVE")).toBe(
      true,
    );
  });
});

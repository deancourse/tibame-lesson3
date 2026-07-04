import request from "supertest";
import { buildApp } from "../app.js";
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

describe("vehicles", () => {
  test("admin sees all, user sees only own", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const user = await makeEmployee({ role: "USER", username: "user1" });
    const other = await makeEmployee({ role: "USER", username: "user2" });
    await makeVehicle({ ownerId: user.id });
    await makeVehicle({ ownerId: other.id });
    await makeVehicle({ ownerId: null });

    const adminSession = await loginAs(app, "admin1");
    const adminRes = await request(app)
      .get("/api/vehicles")
      .set("Cookie", adminSession.cookies);
    expect(adminRes.body.items.length).toBe(3);

    const userSession = await loginAs(app, "user1");
    const userRes = await request(app)
      .get("/api/vehicles")
      .set("Cookie", userSession.cookies);
    expect(userRes.body.items.length).toBe(1);
    expect(userRes.body.items[0].ownerId).toBe(user.id);
  });

  test("user cannot override owner filter via query", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const user = await makeEmployee({ role: "USER", username: "user1" });
    const other = await makeEmployee({ role: "USER", username: "user2" });
    await makeVehicle({ ownerId: other.id });

    const userSession = await loginAs(app, "user1");
    const res = await request(app)
      .get(`/api/vehicles?ownerId=${other.id}`)
      .set("Cookie", userSession.cookies);
    expect(res.body.items.length).toBe(0);
    void user;
  });

  test("user reading another's vehicle -> 404 (not 403)", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const user = await makeEmployee({ role: "USER", username: "user1" });
    const other = await makeEmployee({ role: "USER", username: "user2" });
    const car = await makeVehicle({ ownerId: other.id });
    const userSession = await loginAs(app, "user1");
    const res = await request(app)
      .get(`/api/vehicles/${car.id}`)
      .set("Cookie", userSession.cookies);
    expect(res.status).toBe(404);
    expect(res.body.error.code).toBe("VEHICLE_NOT_FOUND");
    void user;
  });

  test("user mutation -> 403", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    await makeEmployee({ role: "USER", username: "user1" });
    const session = await loginAs(app, "user1");
    const res = await withAuth(request(app).post("/api/vehicles"), session).send({
      plate: "ABC-1234",
      make: "Toyota",
      model: "Corolla",
      year: 2024,
      color: "白",
      status: "AVAILABLE",
      mileage: 100,
      purchasedAt: "2024-01-01",
    });
    expect(res.status).toBe(403);
  });

  test("admin POST plate conflict -> 409", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const session = await loginAs(app, "admin1");
    const body = {
      plate: "ABC-1234",
      make: "Toyota",
      model: "Corolla",
      year: 2024,
      color: "白",
      status: "AVAILABLE",
      mileage: 100,
      purchasedAt: "2024-01-01",
    };
    const ok = await withAuth(request(app).post("/api/vehicles"), session).send(body);
    expect(ok.status).toBe(201);
    const dup = await withAuth(request(app).post("/api/vehicles"), session).send(body);
    expect(dup.status).toBe(409);
    expect(dup.body.error.code).toBe("VEHICLE_PLATE_CONFLICT");
  });

  test("admin PATCH plate conflict -> 409", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const first = await makeVehicle({ plate: "ABC-1234" });
    const second = await makeVehicle({ plate: "XYZ-9999" });
    const session = await loginAs(app, "admin1");
    const res = await withAuth(
      request(app).patch(`/api/vehicles/${second.id}`),
      session,
    ).send({ plate: first.plate });
    expect(res.status).toBe(409);
    expect(res.body.error.code).toBe("VEHICLE_PLATE_CONFLICT");
  });

  test("invalid owner -> 400", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const inactive = await makeEmployee({
      role: "USER",
      username: "u-inactive",
      status: "INACTIVE",
    });
    const session = await loginAs(app, "admin1");
    const res = await withAuth(request(app).post("/api/vehicles"), session).send({
      plate: "XYZ-9999",
      make: "Toyota",
      model: "Corolla",
      year: 2024,
      color: "白",
      status: "AVAILABLE",
      mileage: 100,
      purchasedAt: "2024-01-01",
      ownerId: inactive.id,
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("INVALID_OWNER");
  });

  test("year out of range -> 400", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const session = await loginAs(app, "admin1");
    const res = await withAuth(request(app).post("/api/vehicles"), session).send({
      plate: "OLD-0001",
      make: "Toyota",
      model: "Corolla",
      year: 1800,
      color: "白",
      status: "AVAILABLE",
      mileage: 100,
      purchasedAt: "2024-01-01",
    });
    expect(res.status).toBe(400);
    expect(res.body.error.code).toBe("VALIDATION_ERROR");
  });

  test("admin DELETE -> 204; subsequent GET -> 404", async () => {
    await makeEmployee({ role: "ADMIN", username: "admin1" });
    const car = await makeVehicle();
    const session = await loginAs(app, "admin1");
    const del = await withAuth(request(app).delete(`/api/vehicles/${car.id}`), session);
    expect(del.status).toBe(204);
    const get = await request(app)
      .get(`/api/vehicles/${car.id}`)
      .set("Cookie", session.cookies);
    expect(get.status).toBe(404);
  });
});

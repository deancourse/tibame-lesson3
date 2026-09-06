import { Router, type NextFunction, type Request, type Response } from "express";
import bcrypt from "bcrypt";
import { Prisma } from "../generated/prisma/client.js";
import {
  createEmployeeSchema,
  employeeListQuerySchema,
  resetPasswordSchema,
  updateEmployeeSchema,
} from "@vms/shared";
import { prisma } from "../db/prisma.js";
import { HttpError } from "../lib/http-error.js";
import { requireAdmin, requireAuth } from "../middleware/auth.js";
import { publicEmployee } from "../services/employee-serializer.js";

const UNIQUE_FIELDS_FROM_TARGETS: Record<string, "employeeNo" | "email" | "username"> = {
  employeeNo: "employeeNo",
  email: "email",
  username: "username",
};

function uniqueConflictField(err: unknown): string | undefined {
  if (err instanceof Prisma.PrismaClientKnownRequestError && err.code === "P2002") {
    // Prisma 7 的 driver adapter 不再提供 meta.target，
    // 衝突欄位改放在 meta.driverAdapterError.cause.constraint.fields。
    const meta = err.meta as
      | {
          target?: string[];
          driverAdapterError?: { cause?: { constraint?: { fields?: string[] } } };
        }
      | undefined;
    const target = meta?.target ?? meta?.driverAdapterError?.cause?.constraint?.fields ?? [];
    for (const t of target) {
      if (UNIQUE_FIELDS_FROM_TARGETS[t]) return UNIQUE_FIELDS_FROM_TARGETS[t];
    }
  }
  return undefined;
}

// Registered before csrfGuard in app.ts so DELETE returns 405 instead of CSRF errors.
export function employeesMethodOverride(req: Request, _res: Response, next: NextFunction) {
  if (req.method === "DELETE" && /^\/api\/employees\/[^/]+$/.test(req.path)) {
    throw new HttpError(405, "METHOD_NOT_ALLOWED", "員工不可刪除，請改用 status=INACTIVE");
  }
  next();
}

export const employeesRouter: Router = Router();

employeesRouter.use(requireAuth, requireAdmin);

employeesRouter.get("/", async (req, res) => {
  const q = employeeListQuerySchema.parse(req.query);
  const where: Prisma.EmployeeWhereInput = {};
  if (q.status !== "ALL") where.status = q.status;
  if (q.department) where.department = q.department;
  if (q.search) {
    where.OR = [
      { name: { contains: q.search, mode: "insensitive" } },
      { employeeNo: { contains: q.search, mode: "insensitive" } },
      { email: { contains: q.search, mode: "insensitive" } },
    ];
  }
  const [total, rows] = await Promise.all([
    prisma.employee.count({ where }),
    prisma.employee.findMany({
      where,
      orderBy: { createdAt: "desc" },
      skip: (q.page - 1) * q.pageSize,
      take: q.pageSize,
    }),
  ]);
  res.json({
    items: rows.map(publicEmployee),
    page: q.page,
    pageSize: q.pageSize,
    total,
    totalPages: Math.max(1, Math.ceil(total / q.pageSize)),
  });
});

employeesRouter.get("/:id", async (req, res) => {
  const e = await prisma.employee.findUnique({ where: { id: req.params.id } });
  if (!e) throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "找不到該員工");
  res.json(publicEmployee(e));
});

employeesRouter.post("/", async (req, res) => {
  const data = createEmployeeSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(data.initialPassword, 10);
  try {
    const created = await prisma.employee.create({
      data: {
        employeeNo: data.employeeNo,
        name: data.name,
        email: data.email,
        department: data.department,
        position: data.position,
        hiredAt: data.hiredAt,
        phone: data.phone,
        status: data.status,
        username: data.username,
        passwordHash,
        role: data.role,
      },
    });
    res.status(201).json(publicEmployee(created));
  } catch (err) {
    const field = uniqueConflictField(err);
    if (field) {
      throw new HttpError(409, "EMPLOYEE_CONFLICT", `${field} 已存在`, { field });
    }
    throw err;
  }
});

employeesRouter.patch("/:id", async (req, res) => {
  const data = updateEmployeeSchema.parse(req.body);
  if (req.params.id === req.user!.id && data.role === "USER") {
    throw new HttpError(400, "CANNOT_DEMOTE_SELF", "不能將自己降級為一般使用者");
  }
  try {
    const updated = await prisma.employee.update({
      where: { id: req.params.id },
      data,
    });
    res.json(publicEmployee(updated));
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "找不到該員工");
    }
    const field = uniqueConflictField(err);
    if (field) {
      throw new HttpError(409, "EMPLOYEE_CONFLICT", `${field} 已存在`, { field });
    }
    throw err;
  }
});

employeesRouter.post("/:id/reset-password", async (req, res) => {
  const { newPassword } = resetPasswordSchema.parse(req.body);
  const passwordHash = await bcrypt.hash(newPassword, 10);
  try {
    await prisma.employee.update({
      where: { id: req.params.id },
      data: { passwordHash, failedLoginCount: 0, lockedUntil: null },
    });
    res.status(204).end();
  } catch (err) {
    if (
      err instanceof Prisma.PrismaClientKnownRequestError &&
      err.code === "P2025"
    ) {
      throw new HttpError(404, "EMPLOYEE_NOT_FOUND", "找不到該員工");
    }
    throw err;
  }
});

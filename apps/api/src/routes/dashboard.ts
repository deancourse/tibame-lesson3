import { Router } from "express";
import { Prisma } from "../generated/prisma/client.js";
import { prisma } from "../db/prisma.js";
import { requireAuth } from "../middleware/auth.js";
import { VEHICLE_STATUSES, type VehicleStatus } from "@vms/shared";

export const dashboardRouter: Router = Router();

dashboardRouter.use(requireAuth);

function startOfMonth(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), 1);
}

function addMonths(d: Date, n: number): Date {
  return new Date(d.getFullYear(), d.getMonth() + n, 1);
}

function ymKey(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`;
}

dashboardRouter.get("/summary", async (req, res) => {
  const isAdmin = req.user!.role === "ADMIN";
  const ownerFilter: Prisma.VehicleWhereInput = isAdmin
    ? {}
    : { ownerId: req.user!.employeeId };

  const now = new Date();
  const monthStart = startOfMonth(now);
  const nextMonthStart = addMonths(monthStart, 1);
  const trendStart = addMonths(monthStart, -11);

  const [statusCounts, newThisMonth, totalEmployees] = await Promise.all([
    prisma.vehicle.groupBy({
      by: ["status"],
      where: ownerFilter,
      _count: { _all: true },
    }),
    prisma.vehicle.count({
      where: {
        ...ownerFilter,
        purchasedAt: { gte: monthStart, lt: nextMonthStart },
      },
    }),
    isAdmin
      ? prisma.employee.count({ where: { status: "ACTIVE" } })
      : Promise.resolve(undefined),
  ]);

  const statusMap = new Map<VehicleStatus, number>(
    VEHICLE_STATUSES.map((s) => [s, 0]),
  );
  for (const row of statusCounts) {
    statusMap.set(row.status as VehicleStatus, row._count._all);
  }
  const totalVehicles = [...statusMap.values()].reduce((a, b) => a + b, 0);

  const cards: Record<string, number> = {
    totalVehicles,
    availableVehicles: statusMap.get("AVAILABLE") ?? 0,
    maintenanceVehicles: statusMap.get("MAINTENANCE") ?? 0,
    retiredVehicles: statusMap.get("RETIRED") ?? 0,
    newVehiclesThisMonth: newThisMonth,
  };
  if (isAdmin && typeof totalEmployees === "number") {
    cards.totalEmployees = totalEmployees;
  }

  const statusDistribution = VEHICLE_STATUSES.map((status) => ({
    status,
    count: statusMap.get(status) ?? 0,
  }));

  let vehiclesByDepartment: { department: string; count: number }[] | undefined;
  if (isAdmin) {
    const rows = await prisma.vehicle.findMany({
      select: { owner: { select: { department: true } } },
    });
    const counts = new Map<string, number>();
    for (const r of rows) {
      const dept = r.owner?.department ?? "未指派";
      counts.set(dept, (counts.get(dept) ?? 0) + 1);
    }
    vehiclesByDepartment = [...counts.entries()].map(([department, count]) => ({
      department,
      count,
    }));
  }

  const trendRows = await prisma.vehicle.findMany({
    where: {
      ...ownerFilter,
      purchasedAt: { gte: trendStart, lt: nextMonthStart },
    },
    select: { purchasedAt: true },
  });
  const trendMap = new Map<string, number>();
  for (let i = 0; i < 12; i++) {
    trendMap.set(ymKey(addMonths(monthStart, -11 + i)), 0);
  }
  for (const r of trendRows) {
    const key = ymKey(startOfMonth(r.purchasedAt));
    trendMap.set(key, (trendMap.get(key) ?? 0) + 1);
  }
  const vehiclesTrendLast12Months = [...trendMap.entries()].map(
    ([month, count]) => ({ month, count }),
  );

  const charts: Record<string, unknown> = {
    statusDistribution,
    vehiclesTrendLast12Months,
  };
  if (vehiclesByDepartment) {
    charts.vehiclesByDepartment = vehiclesByDepartment;
  }

  res.json({ cards, charts });
});

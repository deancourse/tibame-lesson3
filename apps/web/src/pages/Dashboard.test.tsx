import type { ReactElement } from "react";
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen } from "@testing-library/react";
import { renderWithProviders } from "@/test/utils";
import { DashboardPage } from "./Dashboard";
import { apiClient } from "@/lib/api";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return { ...actual, apiClient: { get: vi.fn() } };
});

// Recharts uses ResponsiveContainer with size; jsdom needs ResizeObserver shim.
class ResizeObserverMock {
  observe() {}
  unobserve() {}
  disconnect() {}
}
(globalThis as unknown as { ResizeObserver: typeof ResizeObserverMock }).ResizeObserver =
  ResizeObserverMock;

// jsdom 沒有 layout，容器永遠量到 0×0；繞過 ResponsiveContainer，直接以固定尺寸渲染圖表本體。
vi.mock("recharts", async () => {
  const actual = await vi.importActual<typeof import("recharts")>("recharts");
  const { cloneElement } = await import("react");
  return {
    ...actual,
    ResponsiveContainer: ({
      children,
    }: {
      children: ReactElement<{ width?: number; height?: number }>;
    }) => cloneElement(children, { width: 400, height: 300 }),
  };
});

beforeEach(() => {
  vi.mocked(apiClient.get as unknown as ReturnType<typeof vi.fn>).mockReset();
});

describe("DashboardPage", () => {
  it("admin: 6 cards + 3 charts", async () => {
    vi.mocked(apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        cards: {
          totalVehicles: 5,
          availableVehicles: 3,
          maintenanceVehicles: 1,
          retiredVehicles: 1,
          newVehiclesThisMonth: 2,
          totalEmployees: 4,
        },
        charts: {
          statusDistribution: [
            { status: "AVAILABLE", count: 3 },
            { status: "MAINTENANCE", count: 1 },
            { status: "RETIRED", count: 1 },
          ],
          vehiclesByDepartment: [{ department: "A", count: 3 }],
          vehiclesTrendLast12Months: Array.from({ length: 12 }, (_, i) => ({
            month: `2025-${String(i + 1).padStart(2, "0")}`,
            count: 0,
          })),
        },
      },
    });
    render(renderWithProviders(<DashboardPage />));
    expect(await screen.findByText("員工總數")).toBeInTheDocument();
    expect(screen.getByText("各部門車輛數")).toBeInTheDocument();
  });

  it("user: omits employee card and department chart", async () => {
    vi.mocked(apiClient.get as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
      data: {
        cards: {
          totalVehicles: 1,
          availableVehicles: 1,
          maintenanceVehicles: 0,
          retiredVehicles: 0,
          newVehiclesThisMonth: 0,
        },
        charts: {
          statusDistribution: [
            { status: "AVAILABLE", count: 1 },
            { status: "MAINTENANCE", count: 0 },
            { status: "RETIRED", count: 0 },
          ],
          vehiclesTrendLast12Months: Array.from({ length: 12 }, () => ({
            month: "2026-01",
            count: 0,
          })),
        },
      },
    });
    render(renderWithProviders(<DashboardPage />));
    await screen.findByText("狀態分佈");
    expect(screen.queryByText("員工總數")).toBeNull();
    expect(screen.queryByText("各部門車輛數")).toBeNull();
  });

  it("renders error block with retry on failure", async () => {
    vi.mocked(apiClient.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("boom"),
    );
    render(renderWithProviders(<DashboardPage />));
    expect((await screen.findByRole("alert")).textContent).toMatch(/無法載入/);
    expect(screen.getByRole("button", { name: "重試" })).toBeInTheDocument();
  });
});

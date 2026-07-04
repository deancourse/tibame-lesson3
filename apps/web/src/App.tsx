import { useEffect } from "react";
import { Navigate, Route, Routes } from "react-router-dom";
import { Toaster } from "sonner";
import { useAuthStore } from "@/store/auth";
import { hydrateAuthSession } from "@/lib/authHydration";
import { AppShell } from "@/components/AppShell";
import { RequireAdmin, RequireAuth } from "@/components/RequireAuth";
import { LoginPage } from "@/pages/Login";
import { DashboardPage } from "@/pages/Dashboard";
import { VehiclesPage } from "@/pages/Vehicles";
import { EmployeesPage } from "@/pages/Employees";
import { AuditLogsPage } from "@/pages/AuditLogs";

export function App() {
  const hydrated = useAuthStore((s) => s.hydrated);

  useEffect(() => {
    void hydrateAuthSession();
  }, []);

  if (!hydrated) return null;

  return (
    <>
      <Toaster position="top-right" richColors closeButton theme="system" />
      <Routes>
        <Route path="/login" element={<LoginPage />} />
      <Route
        element={
          <RequireAuth>
            <AppShell />
          </RequireAuth>
        }
      >
        <Route index element={<DashboardPage />} />
        <Route path="vehicles" element={<VehiclesPage />} />
        <Route
          path="employees"
          element={
            <RequireAdmin>
              <EmployeesPage />
            </RequireAdmin>
          }
        />
        <Route
          path="audit-logs"
          element={
            <RequireAdmin>
              <AuditLogsPage />
            </RequireAdmin>
          }
        />
      </Route>
        <Route path="*" element={<Navigate to="/" replace />} />
      </Routes>
    </>
  );
}

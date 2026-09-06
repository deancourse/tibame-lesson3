import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { renderWithProviders } from "@/test/utils";
import { LoginPage } from "./Login";
import { apiClient, ApiError } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    apiClient: { post: vi.fn() },
  };
});

const mockNavigate = vi.fn();
vi.mock("react-router-dom", async () => {
  const actual = await vi.importActual<typeof import("react-router-dom")>("react-router-dom");
  return { ...actual, useNavigate: () => mockNavigate };
});

beforeEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, hydrated: true });
  vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>).mockReset();
  mockNavigate.mockReset();
});

describe("LoginPage", () => {
  describe("表單驗證", () => {
    it("帳號留空送出", async () => {
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("密碼"), "password123");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      expect(await screen.findByText("username 必填")).toBeInTheDocument();
      expect(apiClient.post).not.toHaveBeenCalled();
    });

    it("密碼留空送出", async () => {
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("帳號"), "alice");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      expect(await screen.findByText("password 必填")).toBeInTheDocument();
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe("Mock API", () => {
    it("正確帳密登入成功，寫入 session", async () => {
      vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: "1", name: "Alice", role: "USER", employeeId: "1", email: "a@x" },
          csrfToken: "csrf-1",
        },
      });
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("帳號"), "alice");
      await userEvent.type(screen.getByLabelText("密碼"), "password123");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      await waitFor(() => {
        expect(useAuthStore.getState().user?.name).toBe("Alice");
        expect(useAuthStore.getState().csrfToken).toBe("csrf-1");
      });
    });

    it("登入成功後導向首頁", async () => {
      vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>).mockResolvedValue({
        data: {
          user: { id: "1", name: "Alice", role: "USER", employeeId: "1", email: "a@x" },
          csrfToken: "csrf-1",
        },
      });
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("帳號"), "alice");
      await userEvent.type(screen.getByLabelText("密碼"), "password123");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      await waitFor(() => {
        expect(mockNavigate).toHaveBeenCalledWith("/");
      });
    });
  });

  describe("錯誤訊息呈現", () => {
    it("INVALID_CREDENTIALS", async () => {
      vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(401, "INVALID_CREDENTIALS", "bad"),
      );
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("帳號"), "alice");
      await userEvent.type(screen.getByLabelText("密碼"), "wrongwrong");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      expect((await screen.findByRole("alert")).textContent).toMatch(/帳號或密碼錯誤/);
    });

    it("ACCOUNT_LOCKED 含 unlockAt", async () => {
      const unlockAt = new Date(Date.now() + 60_000).toISOString();
      vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(401, "ACCOUNT_LOCKED", "locked", { unlockAt }),
      );
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("帳號"), "alice");
      await userEvent.type(screen.getByLabelText("密碼"), "wrongwrong");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/鎖定/);
    });

    it("ACCOUNT_LOCKED 不含 unlockAt", async () => {
      vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(401, "ACCOUNT_LOCKED", "locked"),
      );
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("帳號"), "alice");
      await userEvent.type(screen.getByLabelText("密碼"), "wrongwrong");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      expect((await screen.findByRole("alert")).textContent).toBe("帳號暫時鎖定，請稍後再試");
    });

    it("ACCOUNT_INACTIVE", async () => {
      vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new ApiError(401, "ACCOUNT_INACTIVE", "inactive"),
      );
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("帳號"), "alice");
      await userEvent.type(screen.getByLabelText("密碼"), "password123");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      expect((await screen.findByRole("alert")).textContent).toBe("此帳號已停用，請聯絡管理員");
    });

    it("非 ApiError 例外（例如網路錯誤）", async () => {
      vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
        new Error("network down"),
      );
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("帳號"), "alice");
      await userEvent.type(screen.getByLabelText("密碼"), "password123");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      expect((await screen.findByRole("alert")).textContent).toBe("登入失敗，請稍後再試");
    });
  });

  describe("載入狀態", () => {
    it("送出後按鈕顯示登入中並停用", async () => {
      let resolvePending: (value: { data: { user: unknown; csrfToken: string } }) => void;
      const pending = new Promise<{ data: { user: unknown; csrfToken: string } }>((resolve) => {
        resolvePending = resolve;
      });
      vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>).mockReturnValue(pending);
      render(renderWithProviders(<LoginPage />));
      await userEvent.type(screen.getByLabelText("帳號"), "alice");
      await userEvent.type(screen.getByLabelText("密碼"), "password123");
      await userEvent.click(screen.getByRole("button", { name: /登入/ }));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "登入中…" })).toBeDisabled();
      });
      resolvePending!({
        data: {
          user: { id: "1", name: "Alice", role: "USER", employeeId: "1", email: "a@x" },
          csrfToken: "csrf-1",
        },
      });
      await waitFor(() => {
        expect(useAuthStore.getState().user?.name).toBe("Alice");
      });
    });
  });
});

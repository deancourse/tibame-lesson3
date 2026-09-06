// 測試案例來源:doc/test/frontend/login.md
import { describe, expect, it, vi, beforeEach } from "vitest";
import { render, screen, waitFor } from "@testing-library/react";
import userEvent from "@testing-library/user-event";
import { Route, Routes } from "react-router-dom";
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

const mockedPost = () => vi.mocked(apiClient.post as unknown as ReturnType<typeof vi.fn>);

beforeEach(() => {
  useAuthStore.setState({ user: null, csrfToken: null, hydrated: true });
  mockedPost().mockReset();
});

function renderLogin() {
  return render(
    renderWithProviders(
      <Routes>
        <Route path="/login" element={<LoginPage />} />
        <Route path="/" element={<div>HOME</div>} />
      </Routes>,
      ["/login"],
    ),
  );
}

async function fillAndSubmit(username = "alice", password = "password123") {
  await userEvent.type(screen.getByLabelText("帳號"), username);
  await userEvent.type(screen.getByLabelText("密碼"), password);
  await userEvent.click(screen.getByRole("button", { name: /登入/ }));
}

describe("LoginPage(登入功能)", () => {
  describe("前端元素", () => {
    it("渲染帳號、密碼輸入欄位與登入按鈕", () => {
      renderLogin();
      expect(screen.getByLabelText("帳號")).toBeInTheDocument();
      expect(screen.getByLabelText("密碼")).toHaveAttribute("type", "password");
      expect(screen.getByRole("button", { name: "登入" })).toBeEnabled();
      expect(screen.queryByRole("alert")).toBeNull();
    });

    it("送出期間按鈕 disabled 並顯示「登入中…」", async () => {
      let reject!: (err: unknown) => void;
      mockedPost().mockReturnValue(
        new Promise((_, rej) => {
          reject = rej;
        }),
      );
      renderLogin();
      await fillAndSubmit();
      const pending = await screen.findByRole("button", { name: "登入中…" });
      expect(pending).toBeDisabled();
      reject(new ApiError(401, "INVALID_CREDENTIALS", "bad"));
      await waitFor(() => {
        expect(screen.getByRole("button", { name: "登入" })).toBeEnabled();
      });
    });
  });

  describe("表單驗證", () => {
    it("空白送出時顯示必填錯誤,且不呼叫 API", async () => {
      renderLogin();
      await userEvent.click(screen.getByRole("button", { name: "登入" }));
      expect(await screen.findByText("username 必填")).toBeInTheDocument();
      expect(await screen.findByText("password 必填")).toBeInTheDocument();
      expect(apiClient.post).not.toHaveBeenCalled();
    });
  });

  describe("Mock API", () => {
    it("登入成功寫入 auth store 並導向首頁", async () => {
      mockedPost().mockResolvedValue({
        data: {
          user: { id: "1", name: "Alice", role: "USER", employeeId: "1", email: "a@x" },
          csrfToken: "csrf-1",
        },
      });
      renderLogin();
      await fillAndSubmit();
      expect(await screen.findByText("HOME")).toBeInTheDocument();
      expect(apiClient.post).toHaveBeenCalledWith("/auth/login", {
        username: "alice",
        password: "password123",
      });
      expect(useAuthStore.getState().user?.name).toBe("Alice");
      expect(useAuthStore.getState().csrfToken).toBe("csrf-1");
    });

    it("INVALID_CREDENTIALS 顯示「帳號或密碼錯誤」", async () => {
      mockedPost().mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "bad"));
      renderLogin();
      await fillAndSubmit("alice", "wrongwrong");
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/帳號或密碼錯誤/);
      expect(screen.queryByText("HOME")).toBeNull();
    });

    it("ACCOUNT_LOCKED 顯示鎖定訊息與解鎖時間", async () => {
      const unlockAt = new Date(Date.now() + 60_000).toISOString();
      mockedPost().mockRejectedValue(
        new ApiError(401, "ACCOUNT_LOCKED", "locked", { unlockAt }),
      );
      renderLogin();
      await fillAndSubmit("alice", "wrongwrong");
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/鎖定/);
      expect(alert.textContent).toContain(new Date(unlockAt).toLocaleTimeString());
    });

    it("ACCOUNT_INACTIVE 顯示「此帳號已停用,請聯絡管理員」", async () => {
      mockedPost().mockRejectedValue(new ApiError(401, "ACCOUNT_INACTIVE", "inactive"));
      renderLogin();
      await fillAndSubmit();
      const alert = await screen.findByRole("alert");
      expect(alert.textContent).toMatch(/此帳號已停用/);
    });
  });

  describe("狀態管理", () => {
    it("登入失敗不寫入 auth store", async () => {
      mockedPost().mockRejectedValue(new ApiError(401, "INVALID_CREDENTIALS", "bad"));
      renderLogin();
      await fillAndSubmit("alice", "wrongwrong");
      await screen.findByRole("alert");
      expect(useAuthStore.getState().user).toBeNull();
      expect(useAuthStore.getState().csrfToken).toBeNull();
      expect(screen.queryByText("HOME")).toBeNull();
    });
  });
});

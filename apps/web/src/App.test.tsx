import { StrictMode } from "react";
import { render, screen, waitFor } from "@testing-library/react";
import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { MemoryRouter } from "react-router-dom";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { App } from "@/App";
import { resetAuthHydrationForTests } from "@/lib/authHydration";
import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

vi.mock("@/lib/api", async () => {
  const actual = await vi.importActual<typeof import("@/lib/api")>("@/lib/api");
  return {
    ...actual,
    apiClient: { get: vi.fn(), post: vi.fn() },
  };
});

beforeEach(() => {
  resetAuthHydrationForTests();
  useAuthStore.setState({ user: null, csrfToken: null, hydrated: false });
  vi.mocked(apiClient.get as unknown as ReturnType<typeof vi.fn>).mockReset();
});

function renderApp(initialEntries = ["/"]) {
  const queryClient = new QueryClient({
    defaultOptions: { queries: { retry: false } },
  });

  return render(
    <StrictMode>
      <QueryClientProvider client={queryClient}>
        <MemoryRouter initialEntries={initialEntries}>
          <App />
        </MemoryRouter>
      </QueryClientProvider>
    </StrictMode>,
  );
}

describe("App", () => {
  it("hydrates auth only once when StrictMode replays effects", async () => {
    vi.mocked(apiClient.get as unknown as ReturnType<typeof vi.fn>).mockRejectedValue(
      new Error("Unauthorized"),
    );

    renderApp();

    await waitFor(() => {
      expect(apiClient.get).toHaveBeenCalledTimes(1);
    });
    expect(apiClient.get).toHaveBeenCalledWith("/auth/me");
    expect(await screen.findByRole("heading", { name: /登入/ })).toBeInTheDocument();
  });

  it("hydrates a valid session into the store and protected shell", async () => {
    vi.mocked(apiClient.get as unknown as ReturnType<typeof vi.fn>).mockImplementation(
      async (url: string) => {
        if (url === "/auth/me") {
          return {
            data: {
              user: {
                id: "user-1",
                employeeId: "employee-1",
                name: "Alice",
                email: "alice@vms.local",
                role: "ADMIN",
              },
              csrfToken: "csrf-1",
            },
          };
        }

        throw new Error(`Unexpected GET ${url}`);
      },
    );

    renderApp();

    expect(await screen.findByText("Alice")).toBeInTheDocument();
    await waitFor(() => {
      expect(useAuthStore.getState().user?.name).toBe("Alice");
      expect(useAuthStore.getState().csrfToken).toBe("csrf-1");
    });
    const authMeCalls = vi
      .mocked(apiClient.get as unknown as ReturnType<typeof vi.fn>)
      .mock.calls.filter(([url]) => url === "/auth/me");
    expect(authMeCalls).toHaveLength(1);
  });
});

import { apiClient } from "@/lib/api";
import { useAuthStore } from "@/store/auth";

let authHydrationPromise: Promise<void> | null = null;

export function hydrateAuthSession(): Promise<void> {
  if (!authHydrationPromise) {
    authHydrationPromise = (async () => {
      const { setSession, clearSession, markHydrated } = useAuthStore.getState();

      try {
        const { data } = await apiClient.get("/auth/me");
        // /me 會回傳依 cookie 內 JWT 推導的 csrfToken，重整後也能還原，後續 mutating 請求（含登出）才不會缺 CSRF。
        setSession(data.user, data.csrfToken);
      } catch {
        clearSession();
      } finally {
        markHydrated();
      }
    })();
  }

  return authHydrationPromise;
}

export function resetAuthHydrationForTests() {
  authHydrationPromise = null;
}

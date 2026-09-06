---
description: 測試案例 - 登入頁（apps/web/src/pages/Login.tsx）
---

> 狀態：初始為 [ ]、完成為 [x]
> 對應測試檔：`apps/web/src/pages/Login.test.tsx`（既有案例已列入，重跑通過後才勾選）

---

## [x] 【表單驗證】帳號留空送出
**範例輸入**：不輸入帳號，密碼輸入 `password123`，點擊「登入」
**期待輸出**：顯示欄位錯誤「username 必填」，`apiClient.post` 不會被呼叫

---

## [x] 【表單驗證】密碼留空送出
**範例輸入**：帳號輸入 `alice`，密碼留空，點擊「登入」
**期待輸出**：顯示欄位錯誤「password 必填」，`apiClient.post` 不會被呼叫

---

## [x] 【Mock API】正確帳密登入成功，寫入 session
**範例輸入**：輸入帳號 `alice`、密碼 `password123`，`apiClient.post` mock 回傳 `{ user, csrfToken: "csrf-1" }`
**期待輸出**：`useAuthStore` 的 `user.name`、`csrfToken` 更新為回傳值

---

## [x] 【Mock API】登入成功後導向首頁
**範例輸入**：同上，登入成功
**期待輸出**：呼叫 `navigate("/")`（或路由導向首頁）

---

## [x] 【錯誤訊息呈現】INVALID_CREDENTIALS
**範例輸入**：`apiClient.post` mock reject `ApiError(401, "INVALID_CREDENTIALS", ...)`
**期待輸出**：畫面顯示「帳號或密碼錯誤」

---

## [x] 【錯誤訊息呈現】ACCOUNT_LOCKED 含 unlockAt
**範例輸入**：`apiClient.post` mock reject `ApiError(401, "ACCOUNT_LOCKED", ..., { unlockAt })`
**期待輸出**：畫面顯示訊息含「鎖定」與解鎖時間

---

## [x] 【錯誤訊息呈現】ACCOUNT_LOCKED 不含 unlockAt
**範例輸入**：`apiClient.post` mock reject `ApiError(401, "ACCOUNT_LOCKED", ...)`（`details` 為 `undefined`）
**期待輸出**：畫面顯示「帳號暫時鎖定，請稍後再試」

---

## [x] 【錯誤訊息呈現】ACCOUNT_INACTIVE
**範例輸入**：`apiClient.post` mock reject `ApiError(401, "ACCOUNT_INACTIVE", ...)`
**期待輸出**：畫面顯示「此帳號已停用，請聯絡管理員」

---

## [x] 【錯誤訊息呈現】非 ApiError 例外（例如網路錯誤）
**範例輸入**：`apiClient.post` mock reject 一般 `Error`（非 `ApiError` 實例）
**期待輸出**：畫面顯示「登入失敗，請稍後再試」

---

## [x] 【載入狀態】送出後按鈕顯示登入中並停用
**範例輸入**：點擊「登入」後、API 回應尚未解析前
**期待輸出**：按鈕文字變為「登入中…」且處於 `disabled` 狀態

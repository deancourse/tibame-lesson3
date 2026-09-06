---
description: 測試案例 - 登入（apps/api/src/routes/auth.ts）
---

> 狀態：初始為 [ ]、完成為 [x]
> 對應測試檔：`apps/api/src/routes/auth.test.ts`（既有案例已列入，重跑通過後才勾選）

---

## [x] 【停用功能】POST /api/auth/register 一律回傳 404
**範例輸入**：`POST /api/auth/register` body `{}`
**期待輸出**：`404`

---

## [x] 【成功登入】正確帳密登入成功
**範例輸入**：既有帳號 `alice` / `password123`，`POST /api/auth/login`
**期待輸出**：`200`，回傳 `user`（不含 `passwordHash`）與 `csrfToken`（字串），`Set-Cookie` 含 `HttpOnly`

---

## [x] 【成功登入】登入成功會重置失敗計數與鎖定狀態
**範例輸入**：帳號 `failedLoginCount = 3` 但未鎖定，輸入正確密碼登入
**期待輸出**：`200`，登入後該帳號 `failedLoginCount = 0`、`lockedUntil = null`

---

## [x] 【驗證失敗】帳號不存在
**範例輸入**：`POST /api/auth/login` 帳號為資料庫中不存在的 `username`
**期待輸出**：`401 INVALID_CREDENTIALS`（不得洩漏帳號是否存在，訊息與密碼錯誤一致）

---

## [x] 【驗證失敗】密碼錯誤
**範例輸入**：既有帳號 `alice`，密碼輸入錯誤
**期待輸出**：`401 INVALID_CREDENTIALS`

---

## [x] 【驗證失敗】username 為空字串
**範例輸入**：`POST /api/auth/login` body `{ username: "", password: "password123" }`
**期待輸出**：`400 VALIDATION_ERROR`

---

## [x] 【驗證失敗】password 為空字串
**範例輸入**：`POST /api/auth/login` body `{ username: "alice", password: "" }`
**期待輸出**：`400 VALIDATION_ERROR`

---

## [x] 【驗證失敗】缺少 username 或 password 欄位
**範例輸入**：`POST /api/auth/login` body 缺少 `password` 欄位
**期待輸出**：`400 VALIDATION_ERROR`

---

## [x] 【帳號鎖定】連續 5 次密碼錯誤鎖定帳號 15 分鐘
**範例輸入**：同一帳號連續輸入錯誤密碼 5 次，再用正確密碼登入
**期待輸出**：前 5 次皆 `401 INVALID_CREDENTIALS`；資料庫 `failedLoginCount = 5`、`lockedUntil` 在未來時間；第 6 次（正確密碼）回傳 `401 ACCOUNT_LOCKED`，`details.unlockAt` 為時間字串

---

## [x] 【帳號鎖定】未達 5 次失敗前不鎖定
**範例輸入**：同一帳號連續輸入錯誤密碼 4 次，再用正確密碼登入
**期待輸出**：前 4 次皆 `401 INVALID_CREDENTIALS` 且帳號未鎖定；第 5 次用正確密碼登入成功 `200`

---

## [x] 【帳號鎖定】鎖定期間即使密碼正確也拒絕，且不再累加失敗次數
**範例輸入**：帳號已鎖定（`lockedUntil` 在未來），用正確密碼再登入一次
**期待輸出**：`401 ACCOUNT_LOCKED`；資料庫 `failedLoginCount` 維持鎖定當下的數值，不再增加

---

## [x] 【帳號停用】INACTIVE 帳號無法登入
**範例輸入**：`status: "INACTIVE"` 的帳號，輸入正確密碼登入
**期待輸出**：`401 ACCOUNT_INACTIVE`

---

## [x] 【查詢登入狀態】GET /api/auth/me 未帶 cookie
**範例輸入**：`GET /api/auth/me` 不附帶 cookie
**期待輸出**：`401 UNAUTHENTICATED`

---

## [x] 【查詢登入狀態】GET /api/auth/me 帶合法 cookie
**範例輸入**：先登入取得 session cookie，再 `GET /api/auth/me`
**期待輸出**：`200`，回傳的 `user.email` 與該帳號一致

---

## [x] 【查詢登入狀態】GET /api/auth/me 回傳的 csrfToken 可用於後續登出
**範例輸入**：登入後呼叫 `/me` 取得 `csrfToken`，用該 token 呼叫 `/logout`
**期待輸出**：`/me` 回傳 `200` 且 `csrfToken` 為字串；用該 token 登出回傳 `204`

---

## [x] 【查詢登入狀態】GET /api/auth/me 對應員工已被刪除
**範例輸入**：登入取得合法 cookie 後，該員工從資料庫被刪除，再 `GET /api/auth/me`
**期待輸出**：`401 UNAUTHENTICATED`

---

## [x] 【查詢登入狀態】GET /api/auth/me token 已過期
**範例輸入**：`GET /api/auth/me` 附帶已過期的 JWT cookie
**期待輸出**：`401 TOKEN_EXPIRED`

---

## [x] 【查詢登入狀態】GET /api/auth/me token 不合法
**範例輸入**：`GET /api/auth/me` 附帶格式錯誤 / 被竄改簽章的 cookie
**期待輸出**：`401 TOKEN_INVALID`

---

## [x] 【登出】未帶 CSRF token
**範例輸入**：登入後 `POST /api/auth/logout` 只帶 session cookie，不帶 `X-CSRF-Token`
**期待輸出**：`403 CSRF_TOKEN_MISSING`

---

## [x] 【登出】帶錯誤的 CSRF token
**範例輸入**：登入後 `POST /api/auth/logout` 帶任意錯誤字串作為 `X-CSRF-Token`
**期待輸出**：`403 CSRF_TOKEN_INVALID`

---

## [x] 【登出】帶正確 CSRF token
**範例輸入**：登入後用 `/me` 或登入回應取得的 `csrfToken` 呼叫 `/logout`
**期待輸出**：`204`

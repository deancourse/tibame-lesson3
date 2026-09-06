# 登入功能測試案例(後端 `POST /api/auth/login`)

> 狀態:初始為 [ ]、完成為 [x]
> 注意:狀態只能在測試通過後由流程更新。
> 測試框架:Jest + supertest(`apps/api`,跑在 `vms_test` 測試 DB)
> 既有測試:`apps/api/src/routes/auth.test.ts` 已涵蓋部分案例,撰寫測試程式時應整併、避免重複。

---

## [x] 【API 整合】成功登入回傳 user 與 csrfToken,並設置 httpOnly cookie
**範例輸入**:`POST /api/auth/login`,body `{ "username": "user1", "password": "正確密碼" }`
**期待輸出**:200,body 含 `user: { id, name, role, employeeId, email }` 與 `csrfToken`;`Set-Cookie` 含 `vms_token`,屬性含 `HttpOnly`

---

## [x] 【輸入驗證】缺少 username 或 password 回傳 400 VALIDATION_ERROR
**範例輸入**:`POST /api/auth/login`,body `{ "username": "user1" }`(無 password)
**期待輸出**:400,`error.code = "VALIDATION_ERROR"`,`details` 含 zod flatten 的欄位錯誤

---

## [x] 【API 整合】帳號不存在回傳 401 INVALID_CREDENTIALS
**範例輸入**:`POST /api/auth/login`,body `{ "username": "no-such-user", "password": "whatever" }`
**期待輸出**:401,`error.code = "INVALID_CREDENTIALS"`,message「帳號或密碼錯誤」(不洩漏帳號是否存在)

---

## [x] 【API 整合】密碼錯誤回傳 401 INVALID_CREDENTIALS,且 failedLoginCount +1
**範例輸入**:對既有帳號送出錯誤密碼一次
**期待輸出**:401 `INVALID_CREDENTIALS`;DB 中該員工 `failedLoginCount` 由 0 變 1,`lockedUntil` 維持 null

---

## [x] 【帳號鎖定】連續 5 次密碼錯誤後帳號鎖定 15 分鐘
**範例輸入**:對同一帳號連續送出 5 次錯誤密碼,再送第 6 次(任意密碼)
**期待輸出**:第 5 次後 DB `lockedUntil` ≈ now + 15 分鐘;第 6 次回 401 `ACCOUNT_LOCKED`,`details.unlockAt` 為 ISO 時間字串

---

## [x] 【帳號鎖定】鎖定期間即使密碼正確仍回傳 ACCOUNT_LOCKED
**範例輸入**:已鎖定的帳號,送出「正確密碼」
**期待輸出**:401,`error.code = "ACCOUNT_LOCKED"`,不發 cookie、不重置失敗計數

---

## [x] 【帳號鎖定】鎖定到期後可重新登入
**範例輸入**:將 DB 中 `lockedUntil` 改為過去時間,送出正確密碼
**期待輸出**:200 登入成功;`failedLoginCount` 重置為 0、`lockedUntil` 重置為 null

---

## [x] 【API 整合】成功登入會重置 failedLoginCount 與 lockedUntil
**範例輸入**:帳號先累積 2 次失敗,再以正確密碼登入
**期待輸出**:200;DB 中 `failedLoginCount = 0`、`lockedUntil = null`

---

## [x] 【API 整合】INACTIVE 帳號無法登入,回傳 401 ACCOUNT_INACTIVE
**範例輸入**:`status = "INACTIVE"` 的帳號,送出正確密碼
**期待輸出**:401,`error.code = "ACCOUNT_INACTIVE"`,message「帳號已停用」,不發 cookie

---

## [x] 【驗證權限】POST /api/auth/login 不受 csrfGuard 攔截
**範例輸入**:帶著舊的 `vms_token` cookie 但「不帶」`X-CSRF-Token` header 呼叫 login
**期待輸出**:不回 403 CSRF 錯誤,照常進入登入流程(成功 200 或憑證錯誤 401)

---

## [x] 【function 邏輯】回傳的 csrfToken 可通過後續 mutating 請求的 CSRF 驗證
**範例輸入**:登入取得 cookie + csrfToken,接著以該組合呼叫 `POST /api/auth/logout`
**期待輸出**:logout 回 204;若改用竄改過的 csrfToken 則回 403 `CSRF_TOKEN_INVALID`

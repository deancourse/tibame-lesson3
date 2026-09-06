# 登入功能測試案例(前端 `LoginPage`)

> 狀態:初始為 [ ]、完成為 [x]
> 注意:狀態只能在測試通過後由流程更新。
> 測試框架:Vitest + Testing Library(`apps/web`,API 以 mock 取代)
> 既有測試:`apps/web/src/pages/Login.test.tsx` 已涵蓋部分案例,撰寫測試程式時應整併、避免重複。

---

## [x] 【前端元素】渲染帳號、密碼輸入欄位與登入按鈕
**範例輸入**:直接渲染 `/login` 頁面
**期待輸出**:畫面包含帳號(text)與密碼(password)輸入框、可點擊的「登入」按鈕,且初始無錯誤訊息

---

## [x] 【表單驗證】空白送出時顯示必填錯誤,且不呼叫 API
**範例輸入**:不填任何欄位,直接點「登入」
**期待輸出**:顯示 username / password 必填錯誤提示;`apiClient.post` 未被呼叫

---

## [x] 【Mock API】登入成功寫入 auth store 並導向首頁
**範例輸入**:填入帳密送出,mock API 回傳 `{ user, csrfToken }`
**期待輸出**:`useAuthStore` 的 `user`、`csrfToken` 被 `setSession` 更新為回傳值;路由導向 `/`

---

## [x] 【Mock API】INVALID_CREDENTIALS 顯示「帳號或密碼錯誤」
**範例輸入**:送出表單,mock API 回 401 `{ error: { code: "INVALID_CREDENTIALS" } }`
**期待輸出**:表單上方出現 `role="alert"` 錯誤訊息「帳號或密碼錯誤」,停留在登入頁

---

## [x] 【Mock API】ACCOUNT_LOCKED 顯示鎖定訊息與解鎖時間
**範例輸入**:mock API 回 401 `ACCOUNT_LOCKED`,`details.unlockAt` 為未來的 ISO 時間
**期待輸出**:錯誤訊息包含「鎖定」字樣與從 `unlockAt` 解析出的時間(HH:mm:ss)

---

## [x] 【Mock API】ACCOUNT_INACTIVE 顯示「此帳號已停用,請聯絡管理員」
**範例輸入**:mock API 回 401 `{ error: { code: "ACCOUNT_INACTIVE" } }`
**期待輸出**:顯示錯誤訊息「此帳號已停用,請聯絡管理員」

---

## [x] 【前端元素】送出期間按鈕 disabled 並顯示「登入中…」
**範例輸入**:送出表單,mock API 延遲回應(pending Promise)
**期待輸出**:等待期間登入按鈕為 disabled 且文字為「登入中…」;回應後恢復

---

## [x] 【狀態管理】登入失敗不寫入 auth store
**範例輸入**:mock API 回 401 `INVALID_CREDENTIALS`
**期待輸出**:`useAuthStore` 的 `user` 與 `csrfToken` 維持 `null`,未發生導向

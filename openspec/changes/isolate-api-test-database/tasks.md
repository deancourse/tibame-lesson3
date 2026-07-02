## 1. Test Database Setup（Test Database Setup）

- [x] 1.1 新增 API 測試資料庫 URL 載入與防呆邏輯，要求 `TEST_DATABASE_URL` 存在且不得與 `DATABASE_URL` 指向同一個 database
- [x] 1.2 新增 TestDB 準備腳本：建立缺失的 test database，並以 Prisma CLI 對 `TEST_DATABASE_URL` 執行 `migrate reset --force --skip-seed --skip-generate`
- [x] 1.3 將 API `test` script 串接 TestDB 準備腳本，並在 Jest `setupFiles` 階段把 Prisma runtime 連線切到 `TEST_DATABASE_URL`
- [x] 1.4 保留並確認 `resetDb()` 會依 dependency-safe order 清理 `AuditLog`、`Vehicle`、`Employee`

## 2. pgAdmin and Documentation（pgAdmin and Documentation）

- [x] 2.1 更新 `.env.example` 與 root/API scripts，加入可單獨準備 TestDB 的指令
- [x] 2.2 更新 pgAdmin 文件，說明如何在 `VMS local` 底下觀察 `vms_test` 測試結果
- [x] 2.3 更新 `README.md`，說明 TestDB 初始化、API 測試不再改寫 dev DB、以及 pgAdmin 查看方式
- [x] 2.4 更新 `AGENTS.md`，移除「API tests share dev DB」規則並改記 TestDB 規則

## 3. Verification（Verification）

- [ ] 3.1 執行 `npm run test:api` 驗證 TestDB 會建立、重置並跑完 API 測試（本次提交前因本機 Docker daemon 未啟動，尚未完成端到端驗證）
- [x] 3.2 執行必要的整體測試或 build 檢查，確認新測試啟動流程沒有破壞 workspace scripts
- [x] 3.3 執行 `openspec validate isolate-api-test-database` 確認 change artifacts 格式有效

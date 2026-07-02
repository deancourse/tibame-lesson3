## Why（動機）

目前 API 測試直接使用 `DATABASE_URL` 指向的 dev database (開發資料庫)，執行 Jest (JavaScript 測試執行器) 時會清空實際開發資料。測試需要獨立的 TestDB (測試資料庫)，並在每輪測試開始時重建 schema (結構)，確保結果可重現且不破壞日常開發資料。

## What Changes（變更內容）

- 新增 `TEST_DATABASE_URL` 環境變數，API 測試只允許連到與 `DATABASE_URL` 不同的 PostgreSQL database。
- API 測試啟動前自動建立 `vms_test` database，並以 Prisma migration reset (資料庫遷移重置) 重建乾淨 schema。
- Jest 啟動時會把 `DATABASE_URL` 改指向 `TEST_DATABASE_URL`，讓所有 route test 與 shared Prisma client 都使用 TestDB。
- 保留每個 test case 前的 `resetDb()` 清理，避免單一測試之間互相污染；整輪測試開始前再做完整 schema reset。
- pgAdmin (Postgres 管理網頁) 預載設定需能觀察 `vms_test`，方便查看最後一個測試留下的資料。
- 更新 `AGENTS.md` 與 `README.md`，記錄測試 DB 指令、規則與 pgAdmin 觀察方式。

## Capabilities（能力清單）

### New Capabilities

- `test-database-isolation`：API 測試資料庫隔離、每輪測試乾淨初始化，以及 pgAdmin 可觀察測試資料。

### Modified Capabilities

（無。此 change 調整測試與本地基礎建設，不改變既有 auth、vehicles、employees、dashboard、audit-log 的產品需求。）

## Impact（影響範圍）

- **新檔案／結構**：新增 API 測試環境初始化檔與測試資料庫準備腳本。
- **依賴新增**
  - api：無，優先使用 Prisma CLI 與既有套件。
  - web：無。
  - shared：無。
- **新增環境變數**：`TEST_DATABASE_URL`，預設建議 `postgresql://vms:vms@localhost:5432/vms_test?schema=public`。
- **新增資料庫 migration**：無；TestDB 套用既有 Prisma migrations。
- **API 路由前綴**：無新增或修改。
- **前端路由**：無新增或修改。
- **測試覆蓋面**：API Jest 啟動流程會先建立並重置 TestDB；現有 route tests 繼續驗證業務行為。
- **Non-goals（非目標）**：本 change 不處理 CI/CD、production database provisioning (正式環境資料庫配置)、parallel API test workers (平行測試 workers)、多租戶資料隔離，亦不新增產品功能。

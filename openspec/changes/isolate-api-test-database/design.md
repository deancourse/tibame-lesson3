## Context（背景）

API 測試目前在 Jest (JavaScript 測試執行器) 中直接載入 `.env` 的 `DATABASE_URL`，因此 Prisma Client (Prisma 資料庫用戶端) 會連到 dev database (開發資料庫)。雖然 `resetDb()` 會在每個 test case 前刪除 `AuditLog`、`Vehicle`、`Employee`，但這仍會破壞開發資料，也無法保證整輪測試開始時 schema (結構) 與 migrations (遷移) 是乾淨狀態。

本地基礎建設已由 `docker-compose.yml` 啟動同一個 Postgres service (服務) 與 pgAdmin (Postgres 管理網頁)。TestDB (測試資料庫) 可以放在同一個 Postgres instance (執行個體) 中，但必須是獨立 database。

## Goals / Non-Goals（目標／非目標）

**Goals:**

- API 測試 SHALL 使用 `TEST_DATABASE_URL` 指向的獨立 PostgreSQL database。
- `TEST_DATABASE_URL` MUST 與 `DATABASE_URL` 指向不同 database，避免誤清 dev DB。
- 每輪 API 測試開始前 MUST 建立 TestDB 並重建 schema。
- 每個 test case 前仍 MUST 清空資料表，維持單一測試隔離。
- pgAdmin MUST 能觀察 `vms_test` database 中最後一次測試留下的資料。

**Non-Goals:**

- 不引入新的資料庫 schema 或產品 migration。
- 不改成平行 API 測試 workers；`maxWorkers: 1` 維持不變。
- 不新增 CI/CD 或 production provisioning (正式環境配置)。
- 不改前端測試流程或業務 API 行為。

## Decisions（決策）

### Decision 1: 使用 `TEST_DATABASE_URL` 作為唯一測試連線來源

**理由**：Jest 啟動時可在 `setupFiles` 階段先載入 `.env`，檢查 `TEST_DATABASE_URL`，再覆寫 process-level `DATABASE_URL`。這讓既有 Prisma client import path 不需要改動，也避免 route tests 與 helper tests 走不同資料來源。

**替代方案**：在所有測試 helper 手動建立獨立 Prisma Client。這會讓 application code 與 test helper 使用不同 client，容易出現部分路由仍打 dev DB 的風險，因此不採用。

### Decision 2: 測試前以 Prisma CLI 執行 `migrate reset --force --skip-seed --skip-generate`

**理由**：TestDB 的 schema 應與既有 migrations 完全一致。使用 Prisma migration reset 可以刪除舊 schema、重套 migrations，避免手寫 SQL truncate 無法處理 enum、index、migration drift (遷移漂移) 等問題；測試前不需要重產 Prisma Client，因此略過 generate 以降低 Windows 鎖檔風險。

**替代方案**：只在 `beforeEach` 刪資料表。這無法清理 migration drift，也無法保證整輪測試從空 schema 開始，因此不採用。

### Decision 3: 測試準備腳本負責建立 database

**理由**：現有 Postgres container 只會在 volume 首次初始化時建立 `POSTGRES_DB=vms`。對已存在的 developer volume，新增 docker init script 不會補建 `vms_test`。由 `npm run test:api` 前置腳本檢查並建立 database，能覆蓋既有與新環境。

**替代方案**：在 `docker-compose.yml` 掛載 `docker-entrypoint-initdb.d` 初始化 SQL。這只對空 volume 生效，對目前使用者的既有 volume 無效，因此不採用。

### Decision 4: pgAdmin 用同一個 server 觀察 dev 與 test database

**理由**：`pgpass` 已使用 wildcard database 欄位，同一個 `VMS local` server 可展開 `vms` 與 `vms_test`。文件只需明確指出測試後展開 `Databases -> vms_test`，避免新增多個 server entry 造成啟動時 TestDB 尚未建立的混淆。

**替代方案**：在 `servers.json` 加第二個 `VMS test` server，maintenance database 指向 `vms_test`。TestDB 尚未建立前該連線會失敗，使用者體驗較差，因此不採用。

## Risks / Trade-offs（風險／取捨）

- **Risk**：`TEST_DATABASE_URL` 缺失或誤指向 dev DB。→ **Mitigation**：Jest setup 與 prepare script 皆執行 URL 檢查，缺失或同 database 時直接失敗。
- **Risk**：每輪測試執行 migration reset 會增加測試時間。→ **Mitigation**：API tests 目前單 worker 且資料量小，換取資料安全與 deterministic (可重現) 狀態。
- **Risk**：pgAdmin 在測試前看不到 `vms_test`。→ **Mitigation**：文件要求先跑 `npm run db:test:prepare` 或 `npm run test:api`，建立 TestDB 後再觀察。

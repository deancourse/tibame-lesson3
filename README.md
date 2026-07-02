# Vehicle Management System (VMS)

內部車輛管理系統。Monorepo（npm workspaces），前端 Vite + React + shadcn/ui，後端 Express + Prisma + Postgres。

---

## 先選定執行環境

請在 **同一個環境** 完成 `npm install`、`npm run db:migrate`、`npm run seed`、`npm run dev`。

- 如果你用 WSL，就在 WSL 終端進入 `/mnt/d/source/repos/tibame-lesson3` 後執行所有 npm 指令。
- 如果你用 Windows PowerShell，就在 `D:\source\repos\tibame-lesson3` 後執行所有 npm 指令。
- 不要在 Windows 跑 `npm install`，又切到 WSL 跑 `npm run dev`；Rollup、Prisma、bcrypt 都有 native/optional dependency，跨 OS 混用 `node_modules` 會出現缺少 `@rollup/rollup-linux-*`、Prisma query engine 不符、或 bcrypt 載入失敗。

如果已經混用過，請先停掉 dev server，然後在你要使用的環境中重建依賴：

```bash
rm -rf node_modules
npm install
npm run db:migrate
```

> Windows PowerShell 沒有 `rm -rf`；若選 Windows，請用 `Remove-Item -Recurse -Force node_modules` 後再 `npm install`。

## 一次性安裝

```bash
cp .env.example .env          # 第一次先複製出來、按需修改
docker compose up -d          # 啟 db (Postgres) + pgadmin (5050)
npm install                   # 安裝所有 workspace 依賴
npm run db:migrate            # 建立 schema，並產生 Prisma Client
npm run seed                  # 建立第一個 admin（讀 .env 的 SEED_ADMIN_*）
npm run seed:mock             # 選用：塞 30 員工 + 50 車輛模擬資料，方便看 dashboard / 分頁
```

第一次啟動若沒有執行 `npm run db:migrate`，API 會連得到 Postgres，但登入時會因為 `Employee` 資料表不存在而回 `500 INTERNAL_ERROR`。

## 日常啟動

先確保 db / pgadmin 在跑：

```bash
docker compose up -d
```

啟動 api + web，兩種擇一：

```bash
# 一鍵：兩邊 log 混在同一終端（concurrently，前綴 [api]/[web]）
npm run dev

# 或 分開兩個終端，各看各的乾淨 log（debug / 讀 log 更清楚）
npm run dev:api   # 終端 A：Express（tsx watch，:8090）
npm run dev:web   # 終端 B：Vite（:3087）
```

`npm run dev` 帶 `--kill-others-on-fail`：任一邊崩了會連帶停掉另一邊，不會留下半殘的 stack。

要停掉：在對應終端按 `Ctrl+C`；docker 服務則 `docker compose down`。

日常啟動只需要：

```bash
docker compose up -d
npm run dev
```

但以下情況要先補跑資料庫指令：

- 第一次 clone / 第一次啟動：`npm run db:migrate && npm run seed`
- `docker compose down -v` 或刪掉 DB volume 後：`npm run db:migrate && npm run seed`
- Prisma schema 或 migration 有更新後：`npm run db:migrate`
- 只看到 `@prisma/client did not initialize yet`：先跑 `npm run db:migrate`；若 DB 已同步但仍失敗，再跑 `npm run db:generate --workspace apps/api`

---

## 服務一覽

| 服務 | URL | 帳密 / 備註 |
|---|---|---|
| Web (Vite dev) | http://localhost:3087 | 若 3087 已被占用會自動往上找（3088、3089…），終端會印實際 port |
| API (Express) | http://localhost:8090 | `GET /api/health` 應回 `{"ok":true}` |
| Postgres | localhost:5432 | DB `vms` / user `vms` / password `vms`（見 `.env`） |
| pgAdmin (Postgres Admin 網頁) | http://localhost:5050 | 預設 `admin@example.com` / `admin`（見 `.env` 的 `PGADMIN_DEFAULT_*`） |

### 三組帳密不要混用

| 用途 | 帳號 | 密碼 | 來源 |
|---|---|---|---|
| Web 系統登入 | `admin` | `admin12345` | `npm run seed` 依 `.env` 的 `SEED_ADMIN_*` 建立 |
| pgAdmin 登入 | `admin@example.com` | `admin` | `.env` 的 `PGADMIN_DEFAULT_*` |
| PostgreSQL 連線 | `vms` | `vms` | `docker-compose.yml` 的 `POSTGRES_*` 與 `.env` 的 `DATABASE_URL` |
| API 測試資料庫 | `vms` | `vms` | `.env` 的 `TEST_DATABASE_URL`，預設 DB 名稱 `vms_test` |

`http://localhost:5050` 是 pgAdmin，不是 VMS 系統登入頁。VMS 系統請開 `http://localhost:3087`，用 `admin` / `admin12345` 登入。建議第一次登入後馬上到「員工管理」改密碼。

### Port 已被占用時怎麼辦

預設已選用較冷門的 8090 / 3087 以降低衝突。若仍被占用，**只需改根目錄 `.env`**（單一來源，不必動程式）：
1. `API_PORT` 與 `API_TARGET` 要對齊（例：`API_PORT=8091` → `API_TARGET=http://127.0.0.1:8091`）。Windows/WSL 環境避免把 `API_TARGET` 寫成 `localhost`，否則 Vite proxy 可能先連到卡住的 IPv6 `::1`。
2. `WEB_PORT` 與 `WEB_ORIGIN` 要對齊（例：`WEB_PORT=3088` → `WEB_ORIGIN=http://localhost:3088`）。
3. 重新 `npm run dev`。

> Vite（web）撞埠會自動往上找一個能用的；但 Express（api）撞埠會直接 `EADDRINUSE` 結束，所以 api 的埠優先挑沒被占用的。`WEB_ORIGIN` 要對齊 web 實際 port，否則 CORS 會擋 cookie。

---

## 使用 pgAdmin

pgAdmin 操作（登入、連 Postgres、手動建 server）詳見 [`infra/pgadmin/README.md`](infra/pgadmin/README.md)。

快速判斷：

- pgAdmin 登入頁帳密是 `admin@example.com` / `admin`
- 左側 server tree 的 **VMS local** 展開後會連到 Docker 裡的 Postgres
- 執行 `npm run db:test:prepare` 或 `npm run test:api` 後，可展開 **Databases → vms_test → Schemas → public → Tables** 看測試資料
- 如果 `postgres` 或 `vms` database 圖示打叉，先執行 `docker compose up -d --force-recreate pgadmin`，讓 `servers.json` 與 `pgpass` 重新載入
- pgAdmin 裡手動新增 server 時，Host 要填 `db`；從主機工具（DBeaver/TablePlus/psql）直連時才填 `localhost`

---

## 預設 Web 操作流程

1. 開 http://localhost:3087（或實際 Vite 印出的 URL）
2. 用 `admin` / `admin12345` 登入
3. Dashboard 應顯示 6 張 card + 3 張 chart（admin 視角）
4. 點左側「員工」可建立新員工（含登入帳號、角色）
5. 點左側「車輛」可建立／編輯／刪除車輛
6. 用建好的 user 帳號（在無痕視窗或別的瀏覽器）登入後：
   - 「員工」連結會消失
   - 「車輛」只看得到 `ownerId = 自己` 的車

---

## 結構

```
apps/
  api/     Express + Prisma（port 8090）
  web/     Vite + React + shadcn/ui（port 3087）
packages/
  shared/  兩邊共用的 zod schema、type、ApiError
infra/
  pgadmin/ pgAdmin 啟動時自動載入的 servers.json + pgpass
docker-compose.yml
openspec/  本專案的需求／設計／規格／任務（OpenSpec）
```

## 常用指令

```bash
npm run dev          # 同時起 api + web（concurrently，--kill-others-on-fail）
npm run dev:api      # 只起 api（Express / tsx watch）
npm run dev:web      # 只起 web（Vite）
npm test             # 跑兩個 app 的測試（api: jest、web: vitest）
npm run test:api     # 只跑 api 測試；會先重建 TEST_DATABASE_URL 指向的 TestDB
npm run test:web     # 只跑 web 測試（vitest）
npm run lint         # ESLint（整個 repo）
npm run db:test:prepare  # 建立/重置 TestDB，不執行 Jest；方便先給 pgAdmin 觀察
npm run db:migrate   # prisma migrate dev
npm run db:generate --workspace apps/api  # 只重新產生 Prisma Client
npm run db:reset     # prisma migrate reset --force（直接重置，不會互動詢問）
npm run db:studio    # 開 prisma studio (5555)
npm run seed         # 重新建立 seed admin
npm run seed:mock    # 開發用：保留 ADMIN、清空其他資料，塞 30 員工 + 50 車輛
```

## API 測試資料庫

API Jest 測試不使用 `DATABASE_URL` 的 dev DB，而是使用 `.env` 的 `TEST_DATABASE_URL`。預設 `.env.example` 已設定：

```bash
TEST_DATABASE_URL=postgresql://vms:vms@localhost:5432/vms_test?schema=public
```

執行：

```bash
npm run test:api
```

流程會先檢查 `TEST_DATABASE_URL` 存在且不能與 `DATABASE_URL` 指向同一個 database，接著建立缺失的 `vms_test`，並對 TestDB 執行 `prisma migrate reset --force --skip-seed --skip-generate`，再跑 Jest。每個 test case 前仍會透過 `resetDb()` 清空 `AuditLog`、`Vehicle`、`Employee`。

若只想建立/重置 TestDB 給 pgAdmin 看，不跑測試：

```bash
npm run db:test:prepare
```

測試結束後，pgAdmin 可展開 **Servers → VMS local → Databases → vms_test → Schemas → public → Tables** 觀察最後一個測試留下的資料。TestDB 只供測試使用；開發資料仍在 `vms`。

## 常見錯誤

### `TEST_DATABASE_URL` 未設定

API 測試會直接失敗，避免 fallback 到 dev DB：

```text
環境變數 TEST_DATABASE_URL 未設定；API 測試必須使用獨立 TestDB。
```

請把 `.env.example` 的 `TEST_DATABASE_URL` 補到本機 `.env`，或在當次指令前設定環境變數。

### `/api/auth/login` 回 `500 INTERNAL_ERROR`

先看 API log。如果有類似：

```text
The table `public.Employee` does not exist in the current database.
```

代表 Postgres 已啟動，但 migration 還沒套用：

```bash
npm run db:migrate
npm run seed
```

如果只是帳密錯，API 應回 `401 INVALID_CREDENTIALS`，不會是 500。

### Web 顯示 `http proxy error: /api/... ECONNREFUSED 127.0.0.1:8090`

這表示 Vite 有啟動，但 API 沒有在 `8090` 跑。請先看 `[api]` log，通常前面會有真正錯誤，例如 Prisma Client 尚未產生、migration 未套用、或 API port 被占用。

### `@prisma/client did not initialize yet`

Prisma Client 尚未產生或 `node_modules` 與目前執行環境不同步：

```bash
npm run db:migrate
```

如果 migration 已同步但仍失敗：

```bash
npm run db:generate --workspace apps/api
```

### `Cannot find module @rollup/rollup-linux-x64-gnu`

通常是 Windows/WSL 混用 `node_modules`，或 npm optional dependencies 沒裝完整。請在同一個環境重建依賴：

```bash
rm -rf node_modules
npm install
```

然後重新：

```bash
npm run db:migrate
npm run dev
```

### Docker Compose 顯示 Windows bind mount / volume 路徑錯誤

本專案的 pgAdmin bind mount 已使用 long syntax：

```yaml
- type: bind
  source: ./infra/pgadmin/servers.json
  target: /pgadmin4/servers.json
  read_only: true
```

請確認：

1. Docker Desktop 使用 Linux containers。
2. 從 repo 根目錄執行 `docker compose up -d`。
3. 如果曾經用舊設定啟動過，執行 `docker compose up -d --force-recreate pgadmin`。

## 規格與設計

- 各 capability 目前的規格（已 sync）位於 `openspec/specs/{auth,dashboard,employees,vehicles}/spec.md`
- 歷史 change（含 proposal、design、tasks、delta specs）位於 `openspec/changes/archive/`
- 新需求請走 OpenSpec workflow（`.cursor/skills/` 與 `openspec-*` / `opsx:*` skills）開 change，不要直接手改主 specs

## 內建 Skills

`.agents/skills/` 下保留多個 OpenSpec 工作流 Skill，可用於後續 change 的提案、實作、驗證、封存。

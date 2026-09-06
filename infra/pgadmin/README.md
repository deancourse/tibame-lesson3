# pgAdmin（Postgres Admin 網頁）

`docker compose up -d` 會一併啟動 pgAdmin（http://localhost:5050）。

## 登入

- Email：`admin@example.com`
- Password：`admin`

（這兩個值定義在根 `.env` 的 `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`，可自行修改）

## 連到 Postgres

**不需要手動 add server**。pgAdmin 啟動時已自動從 `servers.json` 載入一條連線，並透過 `pgpass` 預載密碼。登入後直接：

1. 左側 server tree 展開 **Servers → VMS local**
2. 展開 **Databases**，會看到 `vms`（開發用）與 `vms_test`（apps/api 測試專用，見根目錄 README「API 測試專用 DB」一節）並列
3. 展開 `vms → Schemas → public → Tables`，可以看到 `Employee` 與 `Vehicle` 兩張表；`vms_test` 底下結構相同，是跑 `npm run test:api` 時的資料
4. 對著 table 按右鍵 → **View/Edit Data → All Rows** 即可查資料

> `pgpass` 裡的帳密用 `db:5432:*:vms:vms`（database 欄位是萬用字元 `*`），對這個 Postgres instance 上**任何** database（`vms`、`vms_test`，以及未來新增的）都通用。若改回寫死單一 database 名稱，展開非該 database 的節點時會出現 `fe_sendauth: no password supplied` 連線失敗。

> **改過 `pgpass` 或 `servers.json` 之後記得 `docker compose restart pgadmin`**——這兩個檔案是唯讀 bind mount，只有容器啟動時的 entrypoint 會複製/載入一次，改完不重啟不會生效。
> 測試 DB `vms_test`（由 `npm test` 自動建立／重建）也在同一個 server 底下：展開 **Databases → vms_test** 即可觀察測試留下的資料。`pgpass` 的 DB 欄位是 `*`，連任一 DB 都免輸入密碼。

## 如果要手動建立 Server（萬一 servers.json 沒生效）

按左側 Servers → 右鍵 → Register → Server，填：

| 分頁 | 欄位 | 值 |
|---|---|---|
| General | Name | 任意，例如 `VMS local` |
| Connection | Host name/address | **`db`**（這是 docker network 內的服務名，不是 `localhost`） |
| Connection | Port | `5432` |
| Connection | Maintenance database | `vms` |
| Connection | Username | `vms` |
| Connection | Password | `vms`（勾「Save password」省得每次再輸入） |

> 如果你是從 **host machine 直接連**（例如 `psql`、TablePlus、DBeaver），則用 `localhost:5432` / `vms` / `vms` / `vms`。`db` 這個 hostname 只在 docker compose network 內有效。

# pgAdmin（Postgres Admin 網頁）

`docker compose up -d` 會一併啟動 pgAdmin（http://localhost:5050）。

## 登入

- Email：`admin@example.com`
- Password：`admin`

（這兩個值定義在根 `.env` 的 `PGADMIN_DEFAULT_EMAIL` / `PGADMIN_DEFAULT_PASSWORD`，可自行修改）

## 連到 Postgres

**不需要手動 add server**。pgAdmin 啟動時會從 `servers.json` 載入一條連線，並透過 `pgpass` 預載密碼。`docker-compose.yml` 會在容器啟動時把唯讀掛載的 `/pgpass` 複製成 `/tmp/pgpass`、修正權限，`servers.json` 再用 `ConnectionParameters.passfile` 指向這個密碼檔。`pgpass` 的 database 欄位使用 `*`，讓 pgAdmin 展開同一個 server 底下的 `postgres`、`vms` 與 `vms_test` database 時都能帶入密碼。compose 也設定了 `PGADMIN_REPLACE_SERVERS_ON_STARTUP=True`，所以容器重啟時會重新套用這份 server 設定與密碼檔。登入後直接：

1. 左側 server tree 展開 **Servers → VMS local**
2. 展開 **Databases → vms → Schemas → public → Tables**
3. 可以看到 `Employee` 與 `Vehicle` 兩張表
4. 對著 table 按右鍵 → **View/Edit Data → All Rows** 即可查資料

API 測試資料在獨立的 `vms_test` database。先執行：

```bash
npm run db:test:prepare
```

或：

```bash
npm run test:api
```

然後在 pgAdmin 展開 **Servers → VMS local → Databases → vms_test → Schemas → public → Tables**。測試流程會在每輪開始前重建 TestDB schema，因此 pgAdmin 看到的是最後一次準備或最後一個測試留下的狀態。

如果曾經手動改過 pgAdmin 裡的 server 設定，請重新建立 pgAdmin container 讓啟動設定重套：

```bash
docker compose up -d --force-recreate pgadmin
```

## 如果要手動建立 Server（萬一 servers.json 沒生效）

按左側 Servers → 右鍵 → Register → Server，填：

| 分頁 | 欄位 | 值 |
|---|---|---|
| General | Name | 任意，例如 `VMS local` |
| Connection | Host name/address | **`db`**（這是 docker network 內的服務名，不是 `localhost`） |
| Connection | Port | `5432` |
| Connection | Maintenance database | `vms`（看測試資料也可填 `vms_test`，但需先跑 `npm run db:test:prepare` 建立） |
| Connection | Username | `vms` |
| Connection | Password | `vms`（勾「Save password」省得每次再輸入） |

> 如果你是從 **host machine 直接連**（例如 `psql`、TablePlus、DBeaver），則用 `localhost:5432` / `vms` / `vms` / `vms`。`db` 這個 hostname 只在 docker compose network 內有效。

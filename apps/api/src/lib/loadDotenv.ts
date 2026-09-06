import dotenv from "dotenv";
import path from "node:path";

// 從 repo 根載入共享 .env。所有 api script（dev / start / seed / db:* / test）
// 的 cwd 都是 apps/api，因此 ../../.env 一律指向 repo 根目錄。
// dotenv 17 起預設會印出載入訊息，quiet 關閉以免污染測試與 CLI 輸出。
dotenv.config({ path: path.resolve(process.cwd(), "../../.env"), quiet: true });

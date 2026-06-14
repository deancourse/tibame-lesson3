---
name: Git PR Description
description: 根據當前 branch 與目標 branch 的差異，自動產生 Pull Request 的 Title 與 Description。當使用者提到「PR」、「Pull Request」、「寫 PR」、「PR 描述」、「PR description」、「建立 PR」時觸發此 Skill。
---

# Git PR Description — 自動產生 PR 標題與描述

根據當前 branch 相對於目標 branch（預設 `master`）的所有 commit 與 diff，產出結構化的 PR Title 與 Description。

---

## 流程

### 1. 確認分支資訊

取得當前 branch 名稱與目標 branch：

```bash
git branch --show-current
```

預設目標 branch 為 `master`。若使用者指定其他 base branch，以使用者指定為準。

確認當前 branch 相對於目標 branch 有 commit 差異：

```bash
git log --oneline master..HEAD
```

若無差異，告知使用者「當前 branch 與目標 branch 沒有差異」後結束。

---

### 2. 蒐集變更資訊

取得完整的 commit 列表與 diff：

```bash
# commit 摘要
git log --oneline master..HEAD

# 詳細 commit 訊息
git log --format="%h %s%n%b" master..HEAD

# 變更檔案統計
git diff --stat master..HEAD

# 完整 diff（用於分析具體改動）
git diff master..HEAD
```

---

### 3. 分析變更內容

根據蒐集到的資訊，分析：

- **變更的目的**：這個 branch 要解決什麼問題或新增什麼功能
- **修改範圍**：涉及哪些元件、模組、設定檔
- **影響層面**：是否有破壞性變更、是否影響既有功能
- **環境影響**：切到此 branch（或合併後 pull）的人是否需要手動執行指令才能正常運作——lockfile 變動（需重新 install）、codegen 產物不進版控（需重新 generate）、新增 DB migration、新增 / 改名環境變數、docker 或 infra 設定變更

---

### 4. 產生 PR Title

#### Title 格式

```
<type>: <簡短描述>
```

**type 對照表：**

| type | 使用時機 |
|------|----------|
| `feat` | 新增功能 |
| `fix` | 修復 bug |
| `refactor` | 重構 |
| `style` | 樣式調整 |
| `chore` | 雜務、設定 |
| `docs` | 文件更新 |
| `test` | 測試相關 |

**Title 規則：**

- 不超過 72 字
- 用動詞開頭：新增、調整、修正、移除、重構
- 精準描述此 PR 的核心目的
- 業界通用的技術術語保留英文（見下方術語規範）

---

### 5. 產生 PR Description

讀取 `references/pr-template.md`，依其結構與規則填寫 Description。模板內的 HTML 註解（`<!-- ... -->`）已載明各區塊的產生條件、分組方式與格式規則，是唯一事實來源——填寫時遵照註解，產出的內容不保留註解。

模板涵蓋四個區塊：

- **🎯 為什麼要這樣做** — 背景與動機
- **⚠️ 修改的內容** — 依功能 / 需求分組，逐檔列出修改點
- **📦 切換 branch 後需執行的指令** — 僅在有環境影響時產生（條件見模板註解）
- **🧪 測試步驟** — 後端 / 前端 / CI·Infra 三區塊，僅產生實際涉及者

格式硬規則（連結禁用、路徑置前、術語保留英文）見本檔末「🛑 格式嚴格規範」，對模板與 Title 同時生效。

---

### 6. 輸出結果

將完整的 PR Title + Description 寫入專案根目錄的 `pr-review.md` 檔案。若檔案已存在則直接覆蓋。

**檔案內容格式：**
- 第一行為 PR Title
- 空一行後接 Description（完整 markdown 內容，包含 ##、###、列表等格式）

**輸出流程：**
1. 確認 `.gitignore` 是否包含 `pr-review.md`；若無，自動將 `pr-review.md` 加入 `.gitignore` 最後一行，並告知使用者已新增
2. 使用 Write 工具將內容寫入專案根目錄的 `pr-review.md`
3. 在對話中告知使用者檔案已產生，提醒可開啟檢視
4. 使用者可要求調整任何部分，調整後重新寫入同一檔案
5. 使用者確認內容後，詢問是否要執行 `gh pr create`

---

### 7. 建立 PR（可選）

使用者確認 `pr-review.md` 內容後，依下列流程引導：

#### 步驟 7-1：確認前置條件

執行以下指令確認 `gh` CLI 是否可用：

```bash
gh --version
```

- **若指令不存在（exit code 127）**：
  先偵測作業系統，再給對應安裝指令：

  **macOS：**
  ```
  gh CLI 未安裝，請先執行：
    brew install gh
    gh auth login
  ```

  **Linux：**
  ```
  gh CLI 未安裝，請先執行：
    sudo apt install gh   # Debian/Ubuntu
    # 或參考 https://cli.github.com/manual/installation
    gh auth login
  ```

  **Windows（PowerShell）：**
  ```
  gh CLI 未安裝，請先執行：
    winget install --id GitHub.cli
    gh auth login
  ```

  告知使用者完成後再告知我，我會繼續建立 PR，並等待使用者回應後再繼續。

- **若已安裝**：繼續下一步。

#### 步驟 7-2：確認 push 狀態

執行：

```bash
git status -sb
```

若當前 branch 尚未推上遠端（無 `origin/...` tracking），提示使用者：

```
目前 branch 尚未推送到遠端，即將執行 git push，確認嗎？（yes/no）
```

等使用者確認後執行 `git push -u origin <branch>`。

#### 步驟 7-3：執行 gh pr create

讀取 `pr-review.md`，執行：

```bash
gh pr create --title "<第一行的 PR Title>" --body "$(tail -n +3 pr-review.md)" --base <目標 branch>
```

- Title 取 `pr-review.md` 第一行（去除前後空白）
- Body 取第三行起的完整內容（跳過第一行 title 與第二行空行）
- 若使用者已指定 `--draft` 或其他 flag，依指示加入

#### 步驟 7-4：回報結果

- **成功**：回傳 PR URL，提示使用者可至 GitHub 確認
- **失敗**：顯示錯誤訊息，說明可能原因（如 branch 不存在、無推送權限），引導使用者排除後再試

**注意事項：**
- `pr-review.md` 已加入 `.gitignore`，不會被提交
- Description 中每條修改點格式為 **路徑**：說明，路徑粗體置前，說明不可省略；同一檔案多個修改點時路徑只列一次，修改點以巢狀 bullets 呈現。

---

## 🛑 格式嚴格規範

- **禁止任何 Markdown 連結格式**：`[文字](...)`
- **禁止任何 URI / scheme**：比如 `file://`、`cci:`
- **檔案路徑置前、說明置後**：格式為 **path/to/file**：功能說明，路徑粗體，冒號後接說明，不可省略說明只留路徑
- **同一檔案不重複列路徑**：同一檔案有多個修改點時，路徑只出現一次，其下以巢狀 bullets 列出各修改點

### 術語規範

業界通用的技術 / 產品術語**保留英文原文**，不翻譯為中文。中文句子中直接嵌入英文術語即可。

常見應保留的術語（不限於此列表）：

| 類別 | 保留英文 | ❌ 避免 |
|------|----------|---------|
| 功能模組 | Report, Template, Policy, Config, Settings | 報表, 範本, 政策, 設定 |
| 技術概念 | API, Mock, Type, Service, Controller, Model | 介面, 模擬資料, 型別 |
| 產品名詞 | Site, Domain, Branding, Proxy, Hosting | 站點, 網域, 品牌 |
| 動作 / 狀態 | Validate, Filter, Disable, Parse | 驗證, 篩選, 停用, 解析 |

**使用方式**：以中文動詞 + 英文名詞組合，例如：
- ✅ 「新增 DP Proxy Report Policy validate 邏輯」
- ❌ 「新增 DP Proxy 報表政策驗證邏輯」
- ✅ 「依 Policy 控制 Template 可見性」
- ❌ 「依政策控制範本可見性」

## 邊界情況處理

- **存在未提交的變更**：提醒使用者先提交或 stash，避免遺漏

## Additional Resources

### Reference Files

- **`references/pr-template.md`** — PR Description 的完整模板，可依團隊需求客製化
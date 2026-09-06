# syntax=docker/dockerfile:1
# 後端（@vms/api）多階段建置。build context 必須是 repo 根目錄：
#   docker build -f apps/api/Dockerfile -t vms-api .

############################################################################
# Stage 1: builder — 安裝完整依賴（含 dev）、產生 Prisma client、編譯 TypeScript。
# docker-compose-prod.yml 的 migrate 服務也跑這個 stage（內含 prisma CLI、
# migrations 與 seed 腳本），負責 `prisma migrate deploy` 與建立 admin。
############################################################################
FROM node:24-alpine AS builder
WORKDIR /app

# 先只複製 manifests，讓 npm ci 這一層吃得到 Docker layer cache。
# --ignore-scripts：跳過 root 的 husky prepare（image 內沒有 .git 會失敗）；
# bcrypt 走內附 prebuilds（musl 也有）、Prisma client 由下面顯式 generate，不受影響。
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w apps/api --ignore-scripts --no-audit --no-fund

COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/api apps/api

# prisma generate 輸出到 src/generated/prisma，tsc 會一併編進 dist。
# Prisma 7 載入 prisma.config.ts 時就要求 DATABASE_URL 存在（即使 generate
# 不連線），給一個假值即可——真正的連線字串是 runtime 由 compose 注入。
RUN DATABASE_URL="postgresql://build:build@localhost:5432/build" npm run db:generate -w apps/api \
 && npx tsc -p packages/shared/tsconfig.json \
 && npm run build -w apps/api

# @vms/shared 開發期直接以 TS 原始碼被使用（exports 指向 src/index.ts），但
# production 的 node 跑不動它（套件內部 import 用 .js 副檔名、實檔是 .ts）。
# 這裡把 exports 改指向剛編譯出的 dist——只改 image 內的副本，不影響 repo。
RUN node -e "\
const fs = require('node:fs'); \
const p = 'packages/shared/package.json'; \
const pkg = JSON.parse(fs.readFileSync(p, 'utf8')); \
pkg.main = './dist/index.js'; \
pkg.types = './dist/index.d.ts'; \
pkg.exports = { '.': { types: './dist/index.d.ts', default: './dist/index.js' } }; \
fs.writeFileSync(p, JSON.stringify(pkg, null, 2));"

############################################################################
# Stage 2: prod-deps — 乾淨地只裝 runtime 依賴（--omit=dev）
############################################################################
FROM node:24-alpine AS prod-deps
WORKDIR /app

COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci --omit=dev -w apps/api --ignore-scripts --no-audit --no-fund \
 && npm cache clean --force

############################################################################
# Stage 3: runner — 最終映像，只保留執行所需檔案
############################################################################
FROM node:24-alpine AS runner
ENV NODE_ENV=production
WORKDIR /app

# runtime 依賴 + workspace 殼。node_modules/@vms/shared 是指向
# ../../packages/shared 的 symlink，因此最終映像必須保留同樣的目錄結構。
COPY --from=prod-deps /app /app
# 編譯產物（shared 的 package.json 取 builder 改寫過 exports 的版本）
COPY --from=builder /app/packages/shared/dist packages/shared/dist
COPY --from=builder /app/packages/shared/package.json packages/shared/package.json
COPY --from=builder /app/apps/api/dist apps/api/dist

USER node
WORKDIR /app/apps/api
EXPOSE 8090
CMD ["node", "dist/index.js"]

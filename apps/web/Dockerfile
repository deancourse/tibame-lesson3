# syntax=docker/dockerfile:1
# 前端（@vms/web）多階段建置。build context 必須是 repo 根目錄：
#   docker build -f apps/web/Dockerfile -t vms-web .

############################################################################
# Stage 1: builder — node:24-alpine 安裝依賴、tsc 型別檢查 + vite build
############################################################################
FROM node:24-alpine AS builder
WORKDIR /app

# 先只複製 manifests 以利用 layer cache；--ignore-scripts 跳過 husky prepare
COPY package.json package-lock.json ./
COPY apps/api/package.json apps/api/
COPY apps/web/package.json apps/web/
COPY packages/shared/package.json packages/shared/
RUN npm ci -w apps/web --ignore-scripts --no-audit --no-fund

# vite 會直接 bundle @vms/shared 的 TS 原始碼，所以要帶入 packages/shared
COPY tsconfig.base.json ./
COPY packages/shared packages/shared
COPY apps/web apps/web

RUN npm run build -w apps/web

############################################################################
# Stage 2: runner — nginx-alpine 只裝靜態檔。
# 不用 node 當最終基底：SPA 產物是純靜態檔，且 production 只有前端對外，
# 需要由 nginx 反向代理 /api 到內部的 api 服務（同源、免 CORS）。
############################################################################
FROM nginx:alpine AS runner

COPY apps/web/nginx.conf /etc/nginx/conf.d/default.conf
COPY --from=builder /app/apps/web/dist /usr/share/nginx/html

EXPOSE 80

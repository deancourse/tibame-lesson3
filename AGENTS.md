# AGENTS.md

This file provides guidance to Codex (Codex.ai/code) when working with code in this repository.

## Project

Vehicle Management System (VMS), a Traditional-Chinese internal app. npm workspaces monorepo, Node ≥ 20, ESM throughout.

- `apps/api` — Express 4 + Prisma 6 + Postgres 16. `@vms/api`.
- `apps/web` — Vite + React 18 + shadcn/ui + TanStack Query/Table + Zustand + React Router 7. `@vms/web`.
- `packages/shared` — `@vms/shared`. Zod schemas, shared types, `ApiError` taxonomy. Both ends import from here; do not duplicate schemas.
- `infra/pgadmin` — pgAdmin auto-provisioning (`servers.json` + `pgpass` mounted read-only).
- `openspec/` — change proposals, design, specs, and tasks. The archived `add-vehicle-management-system` change is the source of truth for current behavior. New work follows the OpenSpec workflow (`.cursor/skills/` and the `opsx:*` / `openspec-*` skills).

## One-time setup

```bash
cp .env.example .env
docker compose up -d        # postgres :5432, pgadmin :5050
npm install
npm run db:migrate          # prisma migrate dev (from apps/api)
npm run seed                # creates admin from SEED_ADMIN_USERNAME/PASSWORD
```

## Daily dev

```bash
docker compose up -d        # db must be running
npm run dev                 # concurrently runs api (tsx watch) + web (vite)
```

API listens on `API_PORT` (default 8090 via `.env`); Vite serves on `WEB_PORT` (default 3087 via `.env`) and proxies `/api` to `API_TARGET` (default `http://127.0.0.1:8090`). Prefer `127.0.0.1` over `localhost` for `API_TARGET` on Windows/WSL because `localhost` may resolve to a hanging IPv6 listener. **If you change `API_PORT`, also update `WEB_ORIGIN` (CORS) and `API_TARGET` (Vite proxy) or cookies will break.**

## Commands

```bash
npm run dev            # api + web together
npm run build          # workspace-aware build
npm run lint           # root ESLint + per-workspace lint (api/web currently no-op)
npm test               # all workspace tests
npm run db:test:prepare # apps/api: create/reset TEST_DATABASE_URL database without Jest
npm run db:migrate     # apps/api: prisma migrate dev
npm run db:reset       # prisma migrate reset --force (Prisma still prompts)
npm run db:studio      # prisma studio on :5555
npm run seed           # re-create the admin
```

Single test runs:
- API: `cd apps/api && npm run test:jest -- src/routes/auth.test.ts`
- Web: `cd apps/web && npx vitest run src/pages/Login.test.tsx`

API tests use the dedicated TestDB from `TEST_DATABASE_URL` (default `postgresql://vms:vms@localhost:5432/vms_test?schema=public`), not the dev DB from `DATABASE_URL`. `npm run test:api` first runs `db:test:prepare`, which creates the TestDB if missing and runs `prisma migrate reset --force --skip-seed --skip-generate` against it. Jest `setupFiles` then rewrites `DATABASE_URL` to `TEST_DATABASE_URL` before app modules import Prisma. `jest.config.js` still forces `maxWorkers: 1`; `src/test/setup.ts` exposes `resetDb()` which clears `AuditLog`, `Vehicle`, and `Employee` before each test. pgAdmin can inspect results under **VMS local → Databases → vms_test** after `npm run db:test:prepare` or `npm run test:api`.

## Auth + CSRF (subtle)

The API uses a JWT stored in an httpOnly `vms_token` cookie. The CSRF token is **HMAC-SHA256(JWT, COOKIE_SECRET)** (`apps/api/src/lib/csrf.ts`), returned in the `/api/auth/login` response body, kept in the Zustand `useAuthStore`, and re-attached to mutating requests as `X-CSRF-Token` by the Axios interceptor (`apps/web/src/lib/api.ts`). Consequences:

- `csrfGuard` (`apps/api/src/middleware/auth.ts`) skips non-mutating methods, skips `/api/auth/login`, and skips if there's no cookie (so anonymous mutating calls fall through to `requireAuth` which returns 401, not 403).
- `GET /api/auth/me` returns a fresh CSRF token derived from the existing cookie JWT. On reload, `App.tsx` calls `/me` to restore the authenticated user and a usable `csrfToken`, so logout and other mutating requests can still pass `csrfGuard`.
- `employeesMethodOverride` is registered **before** `csrfGuard` in `apps/api/src/app.ts` so `DELETE /api/employees/:id` returns `405 METHOD_NOT_ALLOWED` (employees aren't deletable — use `status=INACTIVE`). Don't reorder this without updating the spec.

## Errors

All errors flow through `apps/api/src/middleware/error.ts`:
- `HttpError(status, code, message, details?)` → JSON `{ error: { code, message, details } }` with that status.
- `ZodError` → 400 `VALIDATION_ERROR` with `err.flatten()` in `details`.
- Everything else → 500 `INTERNAL_ERROR` (and `console.error` for the server log).

The full code taxonomy lives in `packages/shared/src/errors.ts`. **Add new codes there**, not inline, so both ends stay in sync. The web `apiClient` interceptor unwraps server errors into a typed `ApiError` (`apps/web/src/lib/api.ts`).

## Authorization

`requireAuth` then optionally `requireAdmin`. Two role-sensitive specifics:

- `GET /api/vehicles` and `GET /api/vehicles/:id` auto-scope to `ownerId = req.user.employeeId` when `role === 'USER'`. A USER asking for someone else's vehicle gets 404, not 403 (intentional, to not leak existence).
- `PATCH /api/employees/:id` blocks demoting yourself (`CANNOT_DEMOTE_SELF`).

## Conventions

- `@vms/shared` re-exports everything via `packages/shared/src/index.ts`. New schemas go in `src/schemas/<domain>.ts` and must be re-exported from `index.ts`. The API jest config has a moduleNameMapper that points `@vms/shared` at the source (not `dist`), so you do **not** need to build the package before running API tests.
- ESM only. Import paths use `.js` suffixes inside the API (NodeNext ESM resolution); the jest mapper rewrites `.js` back to `.ts` for tests.
- The root `eslint.config.js` **ignores `apps/**` and `packages/**`**; per-workspace `lint` scripts are currently `echo 'no lint'`. Treat lint as covering root config/scripts only — don't lean on it for type/style checks inside apps.
- Husky `pre-commit` runs `npm run lint` + `npm test` in parallel and fails on either. Both must pass; don't `--no-verify` without a reason.
- Conventional commits in Traditional Chinese (see `git log`): `feat(api):`, `docs(openspec):`, etc.

## Spec workflow

This repo uses OpenSpec. The richest existing artifacts are under `openspec/changes/archive/add-vehicle-management-system/` (proposal, design, tasks, deltas) and the synced specs under `openspec/specs/{auth,dashboard,employees,vehicles}/`. Use the `openspec-*` / `opsx:*` skills (already installed) to propose, apply, verify, and archive changes — don't hand-edit specs without going through a change unless you're fixing typos.

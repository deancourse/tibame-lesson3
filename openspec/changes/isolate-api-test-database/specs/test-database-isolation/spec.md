## ADDED Requirements

### Requirement: API tests use an isolated TestDB
API tests SHALL connect to the PostgreSQL database specified by `TEST_DATABASE_URL`, and SHALL NOT use the dev database specified by `DATABASE_URL`.

#### Scenario: Jest redirects Prisma to TestDB
- **WHEN** `npm run test:api` starts API Jest tests
- **THEN** the test environment MUST set `DATABASE_URL` to `TEST_DATABASE_URL` before application modules import Prisma

#### Scenario: TestDB cannot match dev DB
- **WHEN** `TEST_DATABASE_URL` points to the same PostgreSQL database as `DATABASE_URL`
- **THEN** the test setup MUST fail before any route test executes

### Requirement: API test runs start from a clean schema
The API test command SHALL prepare the TestDB before Jest executes by creating the database if needed and applying the current Prisma migrations from a clean state.

#### Scenario: Test command prepares database
- **WHEN** `npm run test:api` is executed while Postgres is available
- **THEN** the command MUST create the TestDB if missing and run Prisma migration reset against `TEST_DATABASE_URL`

#### Scenario: Missing test database URL
- **WHEN** `TEST_DATABASE_URL` is not configured
- **THEN** the preparation step MUST fail with a clear error instead of falling back to `DATABASE_URL`

### Requirement: Individual API tests remain data-isolated
Each API test case SHALL start with empty `AuditLog`, `Vehicle`, and `Employee` tables in the TestDB.

#### Scenario: Per-test cleanup
- **WHEN** a route test calls the shared `resetDb()` helper before a test case
- **THEN** the helper MUST delete data from `AuditLog`, `Vehicle`, and `Employee` in dependency-safe order

### Requirement: TestDB is observable from pgAdmin
Local pgAdmin SHALL allow developers to inspect the TestDB after running the preparation or test command.

#### Scenario: Inspect test results
- **WHEN** a developer runs `npm run db:test:prepare` or `npm run test:api`
- **THEN** pgAdmin MUST be able to expand `VMS local -> Databases -> vms_test -> Schemas -> public -> Tables` using the preloaded credentials

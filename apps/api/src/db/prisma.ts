import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "../generated/prisma/client.js";
import { env } from "../lib/env.js";

// Prisma 7：改用 driver adapter（node-postgres）連線，
// 連線字串由 lib/env.ts 統一管理（測試時 jest.env.ts 會先覆寫為 TEST_DATABASE_URL）。
const adapter = new PrismaPg({ connectionString: env.DATABASE_URL });

export const prisma = new PrismaClient({ adapter });

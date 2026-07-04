import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@prisma/client";
import "../lib/loadDotenv.js";

const connectionString = process.env.DATABASE_URL;

if (!connectionString) {
  throw new Error("DATABASE_URL is required to initialize PrismaClient");
}

const adapter = new PrismaPg({ connectionString });

export const prisma = new PrismaClient({ adapter });

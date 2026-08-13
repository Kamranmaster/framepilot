import { PrismaPg } from "@prisma/adapter-pg";
import { PrismaClient } from "@/app/generated/prisma/client";

const adapter = new PrismaPg({
  connectionString: process.env.DATABASE_URL!,
});

const globalForPrisma = globalThis as unknown as {
  prisma?: PrismaClient;
};

export const prisma =
  globalForPrisma.prisma ??
  new PrismaClient({
    adapter,
  }); //prismapg adapter to get connection connetion with postgresql according to new prisma version 5.0.0

if (process.env.NODE_ENV !== "production") {
  globalForPrisma.prisma = prisma;
}

const { PrismaClient } = require("@prisma/client");
const { calculateIntakeTotals } = require("../src/lib/intakes");
const { resolveUserContext } = require("../src/lib/rdi");
const { getDayRange } = require("../src/lib/datetime");

const prisma = new PrismaClient();

async function main() {
  const context = await resolveUserContext();
  const { start, end } = getDayRange("2025-09-23", context.timezone ?? "Asia/Taipei");
  const totals = await calculateIntakeTotals({ userId: context.userId, start, end });
  console.log(JSON.stringify(totals, null, 2));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

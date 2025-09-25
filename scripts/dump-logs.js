const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const logs = await prisma.intakeLog.findMany({ include: { items: true } });
  console.log(JSON.stringify(logs, null, 2));
}
main().finally(() => prisma.$disconnect());

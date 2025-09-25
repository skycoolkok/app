const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const data = await prisma.nutritionFact.findMany({ take: 5 });
  console.log(JSON.stringify(data, null, 2));
}
main().finally(() => prisma.$disconnect());

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const recipes = await prisma.recipe.findMany({ include: { ingredients: true } });
  console.log(JSON.stringify(recipes, null, 2));
}
main().finally(() => prisma.$disconnect());

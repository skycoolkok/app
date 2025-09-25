const { PrismaClient } = require('@prisma/client');
const prisma = new PrismaClient();
(async () => {
  const recipes = await prisma.recipe.findMany();
  console.log(JSON.stringify(recipes, null, 2));
})();

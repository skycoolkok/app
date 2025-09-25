const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();
async function main() {
  const log = await prisma.intakeLog.create({
    data: {
      user_id: null,
      logged_at: new Date("2025-09-23T00:00:00+08:00"),
      items: {
        create: {
          recipe_id: 1,
          amount_value: 1.5,
          amount_unit: "serving",
        },
      },
    },
    include: { items: true },
  });
  console.log(JSON.stringify(log, null, 2));
}
main().catch(console.error).finally(() => prisma.$disconnect());

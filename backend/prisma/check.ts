import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Checking database content...');
  const users = await prisma.user.findMany();
  console.log('Users count:', users.length);
  console.log('Users:', users.map(u => u.email));

  const zones = await prisma.zone.findMany({ include: { mappings: true } });
  console.log('Zones count:', zones.length);
  for (const zone of zones) {
    console.log(`Zone: ${zone.name}`);
    for (const mapping of zone.mappings) {
      console.log(`  Mapping: ${mapping.pincode} - ${mapping.areaName}`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding extra credentials...');
  const passwordHash = await bcrypt.hash('123456', 10);

  // 1. Create Second Customer
  const customer2Email = 'customer2@gmail.com';
  const existingCustomer2 = await prisma.user.findUnique({
    where: { email: customer2Email }
  });

  if (!existingCustomer2) {
    await prisma.user.create({
      data: {
        email: customer2Email,
        passwordHash,
        role: 'CUSTOMER'
      }
    });
    console.log(`Created Second Customer: ${customer2Email}`);
  } else {
    console.log(`Second Customer already exists: ${customer2Email}`);
  }

  // 2. Create Third Agent
  const agent3Email = 'agent3@lastmile.com';
  const existingAgent3 = await prisma.user.findUnique({
    where: { email: agent3Email }
  });

  if (!existingAgent3) {
    const user = await prisma.user.create({
      data: {
        email: agent3Email,
        passwordHash,
        role: 'AGENT'
      }
    });

    // Find Zone 1 and Zone 3 to set coverage
    const zone1 = await prisma.zone.findFirst({ where: { name: { contains: 'Zone 1' } } });
    const zone3 = await prisma.zone.findFirst({ where: { name: { contains: 'Zone 3' } } });
    const coverage = [zone1?.id, zone3?.id].filter(Boolean).join(',');

    await prisma.agent.create({
      data: {
        userId: user.id,
        status: 'AVAILABLE',
        currentLat: 12.9668, // Near Whitefield
        currentLng: 77.7499,
        maxConcurrent: 3,
        zoneCoverage: coverage
      }
    });
    console.log(`Created Third Agent: ${agent3Email} (Covers Zones: ${coverage})`);
  } else {
    console.log(`Third Agent already exists: ${agent3Email}`);
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

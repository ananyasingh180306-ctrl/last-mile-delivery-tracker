import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Seeding database...');

  // 1. Clean existing records
  await prisma.orderStatusHistory.deleteMany();
  await prisma.rescheduleRequest.deleteMany();
  await prisma.notificationLog.deleteMany();
  await prisma.order.deleteMany();
  await prisma.agent.deleteMany();
  await prisma.user.deleteMany();
  await prisma.areaZoneMapping.deleteMany();
  await prisma.zone.deleteMany();
  await prisma.rateCard.deleteMany();
  await prisma.cODConfig.deleteMany();

  const passwordHash = await bcrypt.hash('123456', 10);

  // 2. Create Users
  const admin = await prisma.user.create({
    data: {
      email: 'admin@lastmile.com',
      passwordHash,
      role: 'ADMIN'
    }
  });

  const customer = await prisma.user.create({
    data: {
      email: 'customer@gmail.com',
      passwordHash,
      role: 'CUSTOMER'
    }
  });

  const agentUser1 = await prisma.user.create({
    data: {
      email: 'agent1@lastmile.com',
      passwordHash,
      role: 'AGENT'
    }
  });

  const agentUser2 = await prisma.user.create({
    data: {
      email: 'agent2@lastmile.com',
      passwordHash,
      role: 'AGENT'
    }
  });

  console.log('Users created successfully.');

  // 3. Create Zones
  const zone1 = await prisma.zone.create({
    data: { name: 'Zone 1 — Central Bangalore' }
  });

  const zone2 = await prisma.zone.create({
    data: { name: 'Zone 2 — Indiranagar' }
  });

  const zone3 = await prisma.zone.create({
    data: { name: 'Zone 3 — Whitefield' }
  });

  console.log('Zones created successfully.');

  // 4. Create Area-Zone Mappings
  await prisma.areaZoneMapping.createMany({
    data: [
      { pincode: '560001', areaName: 'MG Road / Central', zoneId: zone1.id },
      { pincode: '560038', areaName: 'Indiranagar', zoneId: zone2.id },
      { pincode: '560066', areaName: 'Whitefield', zoneId: zone3.id }
    ]
  });

  console.log('Area-Zone mappings created successfully.');

  // 5. Create Agent Profiles
  // Agent 1 covers Zone 1 and Zone 2, starts in Zone 1 (Central Bangalore)
  await prisma.agent.create({
    data: {
      userId: agentUser1.id,
      status: 'AVAILABLE',
      currentLat: 12.9716,
      currentLng: 77.5946,
      maxConcurrent: 3,
      zoneCoverage: `${zone1.id},${zone2.id}`
    }
  });

  // Agent 2 covers Zone 2 and Zone 3, starts in Zone 2 (Indiranagar)
  await prisma.agent.create({
    data: {
      userId: agentUser2.id,
      status: 'AVAILABLE',
      currentLat: 12.9784,
      currentLng: 77.6408,
      maxConcurrent: 3,
      zoneCoverage: `${zone2.id},${zone3.id}`
    }
  });

  console.log('Agent profiles created successfully.');

  // 6. Create Rate Cards
  const pastDate = new Date();
  pastDate.setFullYear(pastDate.getFullYear() - 1);
  const futureDate = new Date();
  futureDate.setFullYear(futureDate.getFullYear() + 2);

  await prisma.rateCard.createMany({
    data: [
      {
        orderType: 'B2C',
        zoneRelation: 'INTRA',
        baseRate: 40.0,
        perKgRate: 10.0,
        effectiveFrom: pastDate,
        effectiveTo: futureDate
      },
      {
        orderType: 'B2C',
        zoneRelation: 'INTER',
        baseRate: 60.0,
        perKgRate: 15.0,
        effectiveFrom: pastDate,
        effectiveTo: futureDate
      },
      {
        orderType: 'B2B',
        zoneRelation: 'INTRA',
        baseRate: 80.0,
        perKgRate: 8.0,
        effectiveFrom: pastDate,
        effectiveTo: futureDate
      },
      {
        orderType: 'B2B',
        zoneRelation: 'INTER',
        baseRate: 120.0,
        perKgRate: 12.0,
        effectiveFrom: pastDate,
        effectiveTo: futureDate
      }
    ]
  });

  console.log('Rate cards created successfully.');

  // 7. Create COD configs
  await prisma.cODConfig.createMany({
    data: [
      { orderType: 'B2C', surchargeAmount: 25.0 },
      { orderType: 'B2B', surchargeAmount: 50.0 }
    ]
  });

  console.log('COD Configs created successfully.');
  console.log('Database seeding finished successfully!');
}

main()
  .catch((e) => {
    console.error(e);
    process.exit(1);
  })
  .finally(async () => {
    await prisma.$disconnect();
  });

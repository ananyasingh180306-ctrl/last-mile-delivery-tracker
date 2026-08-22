import { PrismaClient } from '@prisma/client';
import bcrypt from 'bcryptjs';

const prisma = new PrismaClient();

async function main() {
  console.log('Registering agent with real email: ananya183singh@gmail.com...');
  const passwordHash = await bcrypt.hash('123456', 10);

  const email = 'ananya183singh@gmail.com';
  const existingUser = await prisma.user.findUnique({
    where: { email }
  });

  if (!existingUser) {
    const user = await prisma.user.create({
      data: {
        email,
        passwordHash,
        role: 'AGENT'
      }
    });

    // Fetch all zones to give full coverage
    const zones = await prisma.zone.findMany();
    const coverage = zones.map(z => z.id).join(',');

    await prisma.agent.create({
      data: {
        userId: user.id,
        status: 'AVAILABLE',
        currentLat: 12.9716, // Bangalore Central
        currentLng: 77.5946,
        maxConcurrent: 3,
        zoneCoverage: coverage
      }
    });
    console.log(`Agent registered successfully: ${email} (Covers all zones: ${coverage})`);
  } else {
    console.log(`User already exists: ${email}`);
    
    // Make sure agent profile exists and covers all zones
    const agent = await prisma.agent.findUnique({
      where: { userId: existingUser.id }
    });
    if (!agent) {
      const zones = await prisma.zone.findMany();
      const coverage = zones.map(z => z.id).join(',');
      await prisma.agent.create({
        data: {
          userId: existingUser.id,
          status: 'AVAILABLE',
          currentLat: 12.9716,
          currentLng: 77.5946,
          maxConcurrent: 3,
          zoneCoverage: coverage
        }
      });
      console.log(`Created missing Agent profile for existing user ${email}.`);
    } else {
      // Update coverage to cover all zones
      const zones = await prisma.zone.findMany();
      const coverage = zones.map(z => z.id).join(',');
      await prisma.agent.update({
        where: { id: agent.id },
        data: {
          status: 'AVAILABLE',
          zoneCoverage: coverage
        }
      });
      console.log(`Updated existing Agent profile for ${email} to be AVAILABLE and cover all zones.`);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

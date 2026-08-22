import { PrismaClient } from '@prisma/client';
import { calculateRates } from '../utils/rateEngine';
import { execSync } from 'child_process';
import fs from 'fs';
import path from 'path';

const testDbPath = path.resolve(__dirname, '../../prisma/test.db');
const TEST_DB_URL = `file:${testDbPath}`;
let prisma: PrismaClient;

beforeAll(async () => {
  // Set the environment variable for tests
  process.env.DATABASE_URL = TEST_DB_URL;

  // Run prisma db push to synchronize database schema
  const schemaPath = path.resolve(__dirname, '../../prisma/schema.prisma');
  execSync(`npx prisma db push --schema="${schemaPath}" --accept-data-loss --force-reset`, {
    stdio: 'ignore',
    env: { ...process.env, DATABASE_URL: TEST_DB_URL }
  });

  prisma = new PrismaClient({
    datasources: {
      db: { url: TEST_DB_URL }
    }
  });

  // Populate basic zone/rate card/COD config for testing
  const zone1 = await prisma.zone.create({ data: { name: 'Zone 1' } });
  const zone2 = await prisma.zone.create({ data: { name: 'Zone 2' } });

  await prisma.areaZoneMapping.createMany({
    data: [
      { pincode: '110001', areaName: 'Pincode 1', zoneId: zone1.id },
      { pincode: '110002', areaName: 'Pincode 2', zoneId: zone1.id }, // Same zone (Intra)
      { pincode: '220001', areaName: 'Pincode 3', zoneId: zone2.id }  // Different zone (Inter)
    ]
  });

  const now = new Date();
  const past = new Date();
  past.setFullYear(now.getFullYear() - 1);
  const future = new Date();
  future.setFullYear(now.getFullYear() + 1);

  await prisma.rateCard.createMany({
    data: [
      {
        orderType: 'B2C',
        zoneRelation: 'INTRA',
        baseRate: 50,
        perKgRate: 10,
        effectiveFrom: past,
        effectiveTo: future
      },
      {
        orderType: 'B2C',
        zoneRelation: 'INTER',
        baseRate: 80,
        perKgRate: 15,
        effectiveFrom: past,
        effectiveTo: future
      },
      {
        orderType: 'B2B',
        zoneRelation: 'INTRA',
        baseRate: 100,
        perKgRate: 8,
        effectiveFrom: past,
        effectiveTo: future
      },
      {
        orderType: 'B2B',
        zoneRelation: 'INTER',
        baseRate: 150,
        perKgRate: 12,
        effectiveFrom: past,
        effectiveTo: future
      }
    ]
  });

  await prisma.cODConfig.createMany({
    data: [
      { orderType: 'B2C', surchargeAmount: 20 },
      { orderType: 'B2B', surchargeAmount: 40 }
    ]
  });
}, 30000);

afterAll(async () => {
  if (prisma) {
    await prisma.$disconnect();
  }
  // Delete the test SQLite file
  const dbFile = path.resolve(__dirname, '../../prisma/test.db');
  if (fs.existsSync(dbFile)) {
    fs.unlinkSync(dbFile);
  }
  const journalFile = path.resolve(__dirname, '../../prisma/test.db-journal');
  if (fs.existsSync(journalFile)) {
    fs.unlinkSync(journalFile);
  }
});

describe('Rate Calculation Engine Tests', () => {
  test('B2C Intra-Zone Calculation with actual weight billing', async () => {
    // 110001 -> 110002 is INTRA.
    // Volumetric weight: 10 * 10 * 10 / 5000 = 0.2kg.
    // Actual weight: 1.5kg (which is higher, so billed at 1.5kg).
    // B2C INTRA baseRate: 50, perKgRate: 10.
    // Charge = 50 + (1.5 * 10) = 65.
    // Prepaid, so COD surcharge = 0. Total = 65.
    const result = await calculateRates({
      prisma,
      pickupPincode: '110001',
      dropPincode: '110002',
      length: 10,
      width: 10,
      height: 10,
      actualWeight: 1.5,
      orderType: 'B2C',
      paymentType: 'PREPAID'
    });

    expect(result.zoneType).toBe('INTRA');
    expect(result.billableWeight).toBe(1.5);
    expect(result.baseCharge).toBe(65);
    expect(result.codSurcharge).toBe(0);
    expect(result.totalCharge).toBe(65);
  });

  test('B2C Inter-Zone Calculation with volumetric weight billing', async () => {
    // 110001 -> 220001 is INTER.
    // Volumetric weight: 40 * 30 * 20 / 5000 = 4.8kg.
    // Actual weight: 2.5kg. Billed on volumetric (4.8kg).
    // B2C INTER baseRate: 80, perKgRate: 15.
    // Base Charge = 80 + (4.8 * 15) = 80 + 72 = 152.
    // COD, so surcharge = 20. Total = 172.
    const result = await calculateRates({
      prisma,
      pickupPincode: '110001',
      dropPincode: '220001',
      length: 40,
      width: 30,
      height: 20,
      actualWeight: 2.5,
      orderType: 'B2C',
      paymentType: 'COD'
    });

    expect(result.zoneType).toBe('INTER');
    expect(result.volumetricWeight).toBe(4.8);
    expect(result.billableWeight).toBe(4.8);
    expect(result.baseCharge).toBe(152);
    expect(result.codSurcharge).toBe(20);
    expect(result.totalCharge).toBe(172);
  });

  test('B2B Intra-Zone Billing with COD surcharge', async () => {
    // 110001 -> 110002 is INTRA.
    // Volumetric weight: 10 * 10 * 10 / 5000 = 0.2kg. Actual: 5.0kg.
    // B2B INTRA baseRate: 100, perKgRate: 8.
    // Base Charge = 100 + (5.0 * 8) = 140.
    // COD, so surcharge = 40. Total = 180.
    const result = await calculateRates({
      prisma,
      pickupPincode: '110001',
      dropPincode: '110002',
      length: 10,
      width: 10,
      height: 10,
      actualWeight: 5.0,
      orderType: 'B2B',
      paymentType: 'COD'
    });

    expect(result.zoneType).toBe('INTRA');
    expect(result.baseCharge).toBe(140);
    expect(result.codSurcharge).toBe(40);
    expect(result.totalCharge).toBe(180);
  });

  test('Throws error for unserviced pincodes', async () => {
    await expect(
      calculateRates({
        prisma,
        pickupPincode: '999999', // Invalid pincode
        dropPincode: '110002',
        length: 10,
        width: 10,
        height: 10,
        actualWeight: 1.0,
        orderType: 'B2C',
        paymentType: 'PREPAID'
      })
    ).rejects.toThrow('Pickup pincode 999999 is not serviced.');
  });
});

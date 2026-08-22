import { PrismaClient } from '@prisma/client';

export interface ChargeBreakdown {
  pickupZoneId: string;
  pickupZoneName: string;
  dropZoneId: string;
  dropZoneName: string;
  zoneType: 'INTRA' | 'INTER';
  length: number;
  width: number;
  height: number;
  volumetricWeight: number;
  actualWeight: number;
  billableWeight: number;
  rateCardId: string;
  baseRate: number;
  perKgRate: number;
  baseCharge: number;
  codSurcharge: number;
  codConfigId: string | null;
  totalCharge: number;
}

export async function calculateRates(params: {
  prisma: PrismaClient;
  pickupPincode: string;
  dropPincode: string;
  length: number; // in cm
  width: number; // in cm
  height: number; // in cm
  actualWeight: number; // in kg
  orderType: 'B2B' | 'B2C';
  paymentType: 'PREPAID' | 'COD';
  timestamp?: Date;
}): Promise<ChargeBreakdown> {
  const { prisma, pickupPincode, dropPincode, length, width, height, actualWeight, orderType, paymentType } = params;
  const now = params.timestamp || new Date();

  // 1. Zone lookup
  const pickupMapping = await prisma.areaZoneMapping.findUnique({
    where: { pincode: pickupPincode },
    include: { zone: true }
  });
  if (!pickupMapping) {
    throw new Error(`Pickup pincode ${pickupPincode} is not serviced.`);
  }

  const dropMapping = await prisma.areaZoneMapping.findUnique({
    where: { pincode: dropPincode },
    include: { zone: true }
  });
  if (!dropMapping) {
    throw new Error(`Drop pincode ${dropPincode} is not serviced.`);
  }

  const zoneType = pickupMapping.zoneId === dropMapping.zoneId ? 'INTRA' : 'INTER';

  // 2. Volumetric Weight calculation
  const volumetricWeight = (length * width * height) / 5000;
  const billableWeight = Math.max(actualWeight, volumetricWeight);

  // 3. Rate Card lookup (active card based on dates)
  const rateCard = await prisma.rateCard.findFirst({
    where: {
      orderType,
      zoneRelation: zoneType,
      effectiveFrom: { lte: now },
      effectiveTo: { gte: now }
    },
    orderBy: {
      effectiveFrom: 'desc'
    }
  });

  if (!rateCard) {
    throw new Error(`No active rate card found for ${orderType} - ${zoneType} zone relation.`);
  }

  // 4. Base Charge calculation
  const rawBaseCharge = rateCard.baseRate + (billableWeight * rateCard.perKgRate);
  const baseCharge = Math.round(rawBaseCharge * 100) / 100;

  // 5. COD Surcharge check
  let codSurcharge = 0;
  let codConfigId: string | null = null;

  if (paymentType === 'COD') {
    const codConfig = await prisma.cODConfig.findUnique({
      where: { orderType }
    });
    if (!codConfig) {
      throw new Error(`No COD configuration found for ${orderType} orders.`);
    }
    codSurcharge = codConfig.surchargeAmount;
    codConfigId = codConfig.id;
  }

  const totalCharge = Math.round((baseCharge + codSurcharge) * 100) / 100;

  return {
    pickupZoneId: pickupMapping.zoneId,
    pickupZoneName: pickupMapping.zone.name,
    dropZoneId: dropMapping.zoneId,
    dropZoneName: dropMapping.zone.name,
    zoneType,
    length,
    width,
    height,
    volumetricWeight: Math.round(volumetricWeight * 100) / 100,
    actualWeight,
    billableWeight: Math.round(billableWeight * 100) / 100,
    rateCardId: rateCard.id,
    baseRate: rateCard.baseRate,
    perKgRate: rateCard.perKgRate,
    baseCharge,
    codSurcharge,
    codConfigId,
    totalCharge
  };
}

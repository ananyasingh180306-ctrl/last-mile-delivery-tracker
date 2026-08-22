import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticateJWT, requireRole, AuthRequest } from '../middlewares/auth';
import { calculateRates } from '../utils/rateEngine';

const router = Router();

const RateCardSchema = z.object({
  orderType: z.enum(['B2B', 'B2C']),
  zoneRelation: z.enum(['INTRA', 'INTER']),
  baseRate: z.number().min(0),
  perKgRate: z.number().min(0),
  effectiveFrom: z.string().transform((str) => new Date(str)),
  effectiveTo: z.string().transform((str) => new Date(str))
});

const CODConfigSchema = z.object({
  orderType: z.enum(['B2B', 'B2C']),
  surchargeAmount: z.number().min(0)
});

const RateCalculationSchema = z.object({
  pickupPincode: z.string(),
  dropPincode: z.string(),
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  actualWeight: z.number().positive(),
  orderType: z.enum(['B2B', 'B2C']),
  paymentType: z.enum(['PREPAID', 'COD'])
});

/**
 * @openapi
 * /rates/cards:
 *   get:
 *     summary: Get all rate cards
 *     tags: [Rates]
 *     responses:
 *       200:
 *         description: List of rate cards
 */
router.get('/cards', async (req, res) => {
  try {
    const cards = await prisma.rateCard.findMany({
      orderBy: { effectiveFrom: 'desc' }
    });
    res.json(cards);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /rates/cards:
 *   post:
 *     summary: Create a rate card
 *     tags: [Rates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderType, zoneRelation, baseRate, perKgRate, effectiveFrom, effectiveTo]
 *             properties:
 *               orderType:
 *                 type: string
 *                 enum: [B2B, B2C]
 *               zoneRelation:
 *                 type: string
 *                 enum: [INTRA, INTER]
 *               baseRate:
 *                 type: number
 *               perKgRate:
 *                 type: number
 *               effectiveFrom:
 *                 type: string
 *                 format: date-time
 *               effectiveTo:
 *                 type: string
 *                 format: date-time
 *     responses:
 *       201:
 *         description: Rate card created
 */
router.post('/cards', authenticateJWT, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const data = RateCardSchema.parse(req.body);
    const card = await prisma.rateCard.create({
      data: {
        orderType: data.orderType,
        zoneRelation: data.zoneRelation,
        baseRate: data.baseRate,
        perKgRate: data.perKgRate,
        effectiveFrom: data.effectiveFrom,
        effectiveTo: data.effectiveTo
      }
    });
    res.status(201).json(card);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Create rate card error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /rates/cod:
 *   get:
 *     summary: Get all COD configs
 *     tags: [Rates]
 *     responses:
 *       200:
 *         description: List of COD configurations
 */
router.get('/cod', async (req, res) => {
  try {
    const codConfigs = await prisma.cODConfig.findMany();
    res.json(codConfigs);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /rates/cod:
 *   post:
 *     summary: Set or update COD surcharge config
 *     tags: [Rates]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [orderType, surchargeAmount]
 *             properties:
 *               orderType:
 *                 type: string
 *                 enum: [B2B, B2C]
 *               surchargeAmount:
 *                 type: number
 *     responses:
 *       200:
 *         description: COD config updated
 */
router.post('/cod', authenticateJWT, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const data = CODConfigSchema.parse(req.body);
    const config = await prisma.cODConfig.upsert({
      where: { orderType: data.orderType },
      update: { surchargeAmount: data.surchargeAmount },
      create: { orderType: data.orderType, surchargeAmount: data.surchargeAmount }
    });
    res.json(config);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /rates/calculate:
 *   post:
 *     summary: Calculate delivery rates pre-confirmation
 *     tags: [Rates]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pickupPincode, dropPincode, length, width, height, actualWeight, orderType, paymentType]
 *             properties:
 *               pickupPincode:
 *                 type: string
 *               dropPincode:
 *                 type: string
 *               length:
 *                 type: number
 *               width:
 *                 type: number
 *               height:
 *                 type: number
 *               actualWeight:
 *                 type: number
 *               orderType:
 *                 type: string
 *                 enum: [B2B, B2C]
 *               paymentType:
 *                 type: string
 *                 enum: [PREPAID, COD]
 *     responses:
 *       200:
 *         description: Charge breakdown
 */
router.post('/calculate', async (req, res) => {
  try {
    const data = RateCalculationSchema.parse(req.body);
    const breakdown = await calculateRates({
      prisma,
      pickupPincode: data.pickupPincode,
      dropPincode: data.dropPincode,
      length: data.length,
      width: data.width,
      height: data.height,
      actualWeight: data.actualWeight,
      orderType: data.orderType,
      paymentType: data.paymentType
    });
    res.json(breakdown);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(400).json({ error: error.message || 'Error calculating rates.' });
  }
});

export default router;

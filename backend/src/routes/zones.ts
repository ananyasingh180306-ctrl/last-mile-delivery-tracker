import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticateJWT, requireRole, AuthRequest } from '../middlewares/auth';

const router = Router();

const ZoneSchema = z.object({
  name: z.string().min(2)
});

const MappingSchema = z.object({
  pincode: z.string().min(3),
  areaName: z.string().min(2),
  zoneId: z.string().uuid()
});

/**
 * @openapi
 * /zones:
 *   get:
 *     summary: Get all zones
 *     tags: [Zones]
 *     responses:
 *       200:
 *         description: List of zones
 */
router.get('/', async (req, res) => {
  try {
    const zones = await prisma.zone.findMany({
      include: { mappings: true }
    });
    res.json(zones);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /zones:
 *   post:
 *     summary: Create a zone
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [name]
 *             properties:
 *               name:
 *                 type: string
 *     responses:
 *       201:
 *         description: Zone created
 */
router.post('/', authenticateJWT, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const data = ZoneSchema.parse(req.body);
    const existingZone = await prisma.zone.findUnique({
      where: { name: data.name }
    });
    if (existingZone) {
      return res.status(400).json({ error: 'Zone with this name already exists.' });
    }

    const zone = await prisma.zone.create({
      data: { name: data.name }
    });
    res.status(201).json(zone);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /zones/mapping:
 *   post:
 *     summary: Map an area pincode to a zone
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pincode, areaName, zoneId]
 *             properties:
 *               pincode:
 *                 type: string
 *               areaName:
 *                 type: string
 *               zoneId:
 *                 type: string
 *     responses:
 *       201:
 *         description: Area mapped successfully
 */
router.post('/mapping', authenticateJWT, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const data = MappingSchema.parse(req.body);

    const existingMapping = await prisma.areaZoneMapping.findUnique({
      where: { pincode: data.pincode }
    });
    if (existingMapping) {
      return res.status(400).json({ error: 'Pincode is already mapped to a zone.' });
    }

    const mapping = await prisma.areaZoneMapping.create({
      data: {
        pincode: data.pincode,
        areaName: data.areaName,
        zoneId: data.zoneId
      }
    });

    res.status(201).json(mapping);
  } catch (error) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /zones/{id}:
 *   delete:
 *     summary: Delete a zone
 *     tags: [Zones]
 *     security:
 *       - bearerAuth: []
 *     parameters:
 *       - in: path
 *         name: id
 *         required: true
 *         schema:
 *           type: string
 *     responses:
 *       200:
 *         description: Zone deleted
 */
router.delete('/:id', authenticateJWT, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    await prisma.zone.delete({
      where: { id }
    });
    res.json({ message: 'Zone deleted successfully.' });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

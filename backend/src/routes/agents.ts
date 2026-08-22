import { Router, Response } from 'express';
import { z } from 'zod';
import bcrypt from 'bcryptjs';
import prisma from '../config/prisma';
import { authenticateJWT, requireRole, AuthRequest } from '../middlewares/auth';

const router = Router();

const LocationUpdateSchema = z.object({
  lat: z.number(),
  lng: z.number()
});

const StatusUpdateSchema = z.object({
  status: z.enum(['AVAILABLE', 'OFFLINE'])
});

const AgentCoverageSchema = z.object({
  zoneCoverage: z.string()
});

/**
 * @openapi
 * /agents:
 *   get:
 *     summary: Get all agents (Admin only)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateJWT, requireRole(['ADMIN']), async (req, res) => {
  try {
    const agents = await prisma.agent.findMany({
      include: { user: true }
    });
    res.json(agents);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

const AgentCreateSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  maxConcurrent: z.number().int().positive().default(3),
  zoneCoverage: z.string().optional().default('')
});

/**
 * @openapi
 * /agents:
 *   post:
 *     summary: Create a new agent profile (Admin only)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 */
router.post('/', authenticateJWT, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const data = AgentCreateSchema.parse(req.body);

    const existingUser = await prisma.user.findUnique({
      where: { email: data.email }
    });
    if (existingUser) {
      return res.status(400).json({ error: 'User with this email already exists.' });
    }

    const passwordHash = await bcrypt.hash(data.password, 10);

    const result = await prisma.$transaction(async (tx) => {
      const user = await tx.user.create({
        data: {
          email: data.email,
          passwordHash,
          role: 'AGENT'
        }
      });

      const agent = await tx.agent.create({
        data: {
          userId: user.id,
          status: 'AVAILABLE',
          currentLat: 12.9716,
          currentLng: 77.5946,
          maxConcurrent: data.maxConcurrent,
          zoneCoverage: data.zoneCoverage || ''
        },
        include: { user: true }
      });

      return agent;
    });

    res.status(201).json(result);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: error.message || 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /agents/profile:
 *   get:
 *     summary: Retrieve current agent profile
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 */
router.get('/profile', authenticateJWT, requireRole(['AGENT']), async (req: AuthRequest, res: Response) => {
  try {
    const agent = await prisma.agent.findUnique({
      where: { userId: req.user!.id },
      include: { user: true }
    });
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found.' });
    }
    res.json(agent);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /agents/location:
 *   post:
 *     summary: Update agent location coords
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 */
router.post('/location', authenticateJWT, requireRole(['AGENT']), async (req: AuthRequest, res: Response) => {
  try {
    const { lat, lng } = LocationUpdateSchema.parse(req.body);

    const agent = await prisma.agent.findUnique({
      where: { userId: req.user!.id }
    });
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found.' });
    }

    const updatedAgent = await prisma.agent.update({
      where: { id: agent.id },
      data: { currentLat: lat, currentLng: lng }
    });

    res.json(updatedAgent);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /agents/status:
 *   post:
 *     summary: Update agent status (AVAILABLE, OFFLINE)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 */
router.post('/status', authenticateJWT, requireRole(['AGENT']), async (req: AuthRequest, res: Response) => {
  try {
    const { status } = StatusUpdateSchema.parse(req.body);

    const agent = await prisma.agent.findUnique({
      where: { userId: req.user!.id }
    });
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found.' });
    }

    // If status is changed to OFFLINE, they shouldn't get new orders, but they still have capacity activeCount.
    // If changed to AVAILABLE, check if they are already at max capacity. If so, set status to BUSY instead.
    let finalStatus = status;
    if (status === 'AVAILABLE' && agent.activeCount >= agent.maxConcurrent) {
      finalStatus = 'BUSY';
    }

    const updatedAgent = await prisma.agent.update({
      where: { id: agent.id },
      data: { status: finalStatus }
    });

    res.json(updatedAgent);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /agents/coverage:
 *   post:
 *     summary: Update agent zone coverage (Admin only)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/coverage', authenticateJWT, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { zoneCoverage } = AgentCoverageSchema.parse(req.body);

    const updatedAgent = await prisma.agent.update({
      where: { id },
      data: { zoneCoverage }
    });

    res.json(updatedAgent);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /agents/{id}/reset-password:
 *   post:
 *     summary: Reset an agent's password to a standard value (Admin only)
 *     tags: [Agents]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reset-password', authenticateJWT, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { password } = req.body;

    const targetPassword = password || '123456';
    const passwordHash = await bcrypt.hash(targetPassword, 10);

    const agent = await prisma.agent.findUnique({
      where: { id }
    });
    if (!agent) {
      return res.status(404).json({ error: 'Agent profile not found.' });
    }

    await prisma.user.update({
      where: { id: agent.userId },
      data: { passwordHash }
    });

    res.json({ message: `Agent password successfully reset to: ${targetPassword}` });
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

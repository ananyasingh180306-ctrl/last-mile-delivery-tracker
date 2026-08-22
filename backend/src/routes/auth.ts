import { Router, Request, Response } from 'express';
import bcrypt from 'bcryptjs';
import jwt from 'jsonwebtoken';
import { z } from 'zod';
import prisma from '../config/prisma';

const router = Router();
const JWT_SECRET = process.env.JWT_SECRET || 'super-secret-key-for-last-mile-delivery-tracker-12345';

const RegisterSchema = z.object({
  email: z.string().email(),
  password: z.string().min(6),
  role: z.enum(['CUSTOMER', 'AGENT', 'ADMIN']),
  // Agent-specific fields
  currentLat: z.number().optional().default(12.9716), // Bangalore coordinates default
  currentLng: z.number().optional().default(77.5946),
  maxConcurrent: z.number().optional().default(3),
  zoneCoverage: z.string().optional().default('') // e.g. "zone-1,zone-2" or pincode
});

const LoginSchema = z.object({
  email: z.string().email(),
  password: z.string()
});

/**
 * @openapi
 * /auth/register:
 *   post:
 *     summary: Register a new user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password, role]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *               role:
 *                 type: string
 *                 enum: [CUSTOMER, AGENT, ADMIN]
 *               currentLat:
 *                 type: number
 *               currentLng:
 *                 type: number
 *               maxConcurrent:
 *                 type: integer
 *               zoneCoverage:
 *                 type: string
 *     responses:
 *       201:
 *         description: User registered successfully
 *       400:
 *         description: Validation error
 */
router.post('/register', async (req: Request, res: Response) => {
  try {
    const data = RegisterSchema.parse(req.body);

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
          role: data.role
        }
      });

      if (data.role === 'AGENT') {
        await tx.agent.create({
          data: {
            userId: user.id,
            status: 'OFFLINE',
            currentLat: data.currentLat,
            currentLng: data.currentLng,
            maxConcurrent: data.maxConcurrent,
            zoneCoverage: data.zoneCoverage
          }
        });
      }

      return user;
    });

    const token = jwt.sign(
      { id: result.id, email: result.email, role: result.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(201).json({
      message: 'Registration successful',
      token,
      user: {
        id: result.id,
        email: result.email,
        role: result.role
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Registration error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /auth/login:
 *   post:
 *     summary: Log in a user
 *     tags: [Authentication]
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [email, password]
 *             properties:
 *               email:
 *                 type: string
 *               password:
 *                 type: string
 *     responses:
 *       200:
 *         description: Login successful, returns token
 *       401:
 *         description: Invalid credentials
 */
router.post('/login', async (req: Request, res: Response) => {
  try {
    const data = LoginSchema.parse(req.body);

    const user = await prisma.user.findUnique({
      where: { email: data.email },
      include: { agentProfile: true }
    });

    if (!user) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const isValidPassword = await bcrypt.compare(data.password, user.passwordHash);
    if (!isValidPassword) {
      return res.status(401).json({ error: 'Invalid email or password.' });
    }

    const token = jwt.sign(
      { id: user.id, email: user.email, role: user.role },
      JWT_SECRET,
      { expiresIn: '7d' }
    );

    res.status(200).json({
      message: 'Login successful',
      token,
      user: {
        id: user.id,
        email: user.email,
        role: user.role,
        agentProfile: user.agentProfile
      }
    });
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Login error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

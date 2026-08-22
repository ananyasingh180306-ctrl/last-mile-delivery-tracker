import { Router, Response } from 'express';
import { z } from 'zod';
import prisma from '../config/prisma';
import { authenticateJWT, requireRole, AuthRequest } from '../middlewares/auth';
import { calculateRates } from '../utils/rateEngine';
import { autoAssignOrder } from '../services/assignment';
import { sendEmailNotification, sendAgentAssignmentEmail } from '../services/notifications';
import { emitOrderUpdate } from '../services/socket';

const router = Router();

const OrderCreateSchema = z.object({
  customerId: z.string().uuid().optional(), // For Admin placing on behalf of customer
  pickupAddress: z.string().min(5),
  pickupPincode: z.string(),
  pickupLat: z.number(),
  pickupLng: z.number(),
  dropAddress: z.string().min(5),
  dropPincode: z.string(),
  dropLat: z.number(),
  dropLng: z.number(),
  length: z.number().positive(),
  width: z.number().positive(),
  height: z.number().positive(),
  actualWeight: z.number().positive(),
  orderType: z.enum(['B2B', 'B2C']),
  paymentType: z.enum(['PREPAID', 'COD'])
});

const StatusUpdateSchema = z.object({
  status: z.enum(['PLACED', 'ASSIGNED', 'PICKED_UP', 'IN_TRANSIT', 'OUT_FOR_DELIVERY', 'DELIVERED', 'FAILED']),
  notes: z.string().optional()
});

const RescheduleSchema = z.object({
  requestedDate: z.string().transform((str) => new Date(str))
});

/**
 * @openapi
 * /orders:
 *   post:
 *     summary: Create an order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 *     requestBody:
 *       required: true
 *       content:
 *         application/json:
 *           schema:
 *             type: object
 *             required: [pickupAddress, pickupPincode, pickupLat, pickupLng, dropAddress, dropPincode, dropLat, dropLng, length, width, height, actualWeight, orderType, paymentType]
 *             properties:
 *               customerId:
 *                 type: string
 *                 format: uuid
 *               pickupAddress:
 *                 type: string
 *               pickupPincode:
 *                 type: string
 *               pickupLat:
 *                 type: number
 *               pickupLng:
 *                 type: number
 *               dropAddress:
 *                 type: string
 *               dropPincode:
 *                 type: string
 *               dropLat:
 *                 type: number
 *               dropLng:
 *                 type: number
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
 *       201:
 *         description: Order created successfully
 */
router.post('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const data = OrderCreateSchema.parse(req.body);
    const currentUser = req.user!;

    // Resolve customer ID
    let finalCustomerId = currentUser.id;
    if (currentUser.role === 'ADMIN' && data.customerId) {
      finalCustomerId = data.customerId;
    }

    const customerUser = await prisma.user.findUnique({
      where: { id: finalCustomerId }
    });
    if (!customerUser) {
      return res.status(404).json({ error: 'Customer not found.' });
    }

    // 1. Calculate rate breakdown
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

    // 2. Database write operations
    const order = await prisma.$transaction(async (tx) => {
      const newOrder = await tx.order.create({
        data: {
          customerId: finalCustomerId,
          pickupAddress: data.pickupAddress,
          pickupPincode: data.pickupPincode,
          pickupLat: data.pickupLat,
          pickupLng: data.pickupLng,
          dropAddress: data.dropAddress,
          dropPincode: data.dropPincode,
          dropLat: data.dropLat,
          dropLng: data.dropLng,
          length: data.length,
          width: data.width,
          height: data.height,
          actualWeight: data.actualWeight,
          orderType: data.orderType,
          paymentType: data.paymentType,
          chargeBreakdown: JSON.stringify(breakdown),
          currentStatus: 'PLACED'
        }
      });

      // Write initial history log
      await tx.orderStatusHistory.create({
        data: {
          orderId: newOrder.id,
          status: 'PLACED',
          actorRole: currentUser.role,
          actorId: currentUser.id,
          notes: 'Order placed by customer.'
        }
      });

      return newOrder;
    });

    // Send placed notification
    await sendEmailNotification(order.id, finalCustomerId, customerUser.email, 'PLACED');

    // 3. Try Auto-assign immediately
    try {
      await autoAssignOrder(order.id);
      console.log(`Auto-assigned order ${order.id} on creation.`);
    } catch (assignError: any) {
      console.log(`Failed auto-assignment on creation: ${assignError.message}. Retaining PLACED status.`);
    }

    // Fetch final updated order state
    const finalOrder = await prisma.order.findUnique({
      where: { id: order.id },
      include: {
        agent: { include: { user: true } },
        statusHistory: { orderBy: { timestamp: 'desc' } }
      }
    });

    if (finalOrder) {
      emitOrderUpdate(finalOrder.id, finalOrder);
      if (finalOrder.agent?.user?.email) {
        await sendEmailNotification(finalOrder.id, finalOrder.customerId, customerUser.email, 'ASSIGNED', `Agent auto-assigned on creation: ${finalOrder.agent.user.email}`);
        await sendAgentAssignmentEmail(finalOrder.id, finalOrder.agent.user.email, finalOrder.pickupPincode, finalOrder.dropPincode);
      }
    }

    res.status(201).json(finalOrder);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Order creation error:', error);
    res.status(400).json({ error: error.message || 'Failed to place order.' });
  }
});

/**
 * @openapi
 * /orders:
 *   get:
 *     summary: Retrieve orders with role-based filtering
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const user = req.user!;
    const { status, zoneId, agentId } = req.query;

    const whereClause: any = {};

    // Role-based visibility
    if (user.role === 'CUSTOMER') {
      whereClause.customerId = user.id;
    } else if (user.role === 'AGENT') {
      // Find agent profile ID
      const agentProfile = await prisma.agent.findUnique({
        where: { userId: user.id }
      });
      if (!agentProfile) {
        return res.status(404).json({ error: 'Agent profile not found.' });
      }
      whereClause.agentId = agentProfile.id;
    } else if (user.role === 'ADMIN') {
      if (agentId) {
        whereClause.agentId = agentId as string;
      }
    }

    // Query Filters
    if (status) {
      whereClause.currentStatus = status as string;
    }
    if (zoneId) {
      whereClause.pickupPincode = zoneId as string; // assuming pincode maps to zone
    }

    const orders = await prisma.order.findMany({
      where: whereClause,
      include: {
        customer: true,
        agent: { include: { user: true } },
        statusHistory: { orderBy: { timestamp: 'desc' } }
      },
      orderBy: { createdAt: 'desc' }
    });

    res.json(orders);
  } catch (error) {
    console.error('Get orders error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /orders/{id}:
 *   get:
 *     summary: Get details of a specific order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.get('/:id', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const user = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        agent: { include: { user: true } },
        statusHistory: {
          include: { actor: true },
          orderBy: { timestamp: 'desc' }
        },
        rescheduleRequests: true
      }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Auth access checks
    if (user.role === 'CUSTOMER' && order.customerId !== user.id) {
      return res.status(403).json({ error: 'Forbidden: access denied.' });
    }
    if (user.role === 'AGENT') {
      const agentProfile = await prisma.agent.findUnique({ where: { userId: user.id } });
      if (!agentProfile || order.agentId !== agentProfile.id) {
        return res.status(403).json({ error: 'Forbidden: access denied.' });
      }
    }

    res.json(order);
  } catch (error) {
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /orders/{id}/assign:
 *   post:
 *     summary: Assign agent manually or trigger auto-assignment
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/assign', authenticateJWT, requireRole(['ADMIN']), async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { agentId } = req.body; // If omitted, triggers auto-assignment

    let assignedAgentId = agentId;

    if (!agentId) {
      // If order already has an assigned agent, unassign first to clear capacity
      const currentOrder = await prisma.order.findUnique({ where: { id } });
      if (currentOrder?.agentId) {
        await prisma.$transaction(async (tx) => {
          const oldAgent = await tx.agent.findUnique({ where: { id: currentOrder.agentId! } });
          if (oldAgent) {
            const decCapacity = Math.max(0, oldAgent.activeCount - 1);
            await tx.agent.update({
              where: { id: currentOrder.agentId! },
              data: { activeCount: decCapacity, status: 'AVAILABLE' }
            });
          }
          await tx.order.update({
            where: { id },
            data: { agentId: null }
          });
        });
      }
      // Trigger auto-assignment
      assignedAgentId = await autoAssignOrder(id);
    } else {
      // Manual assignment/re-assignment
      await prisma.$transaction(async (tx) => {
        const order = await tx.order.findUnique({ where: { id } });
        if (!order) throw new Error('Order not found.');

        // If order already has an assigned agent, decrement that agent's count first!
        if (order.agentId) {
          const oldAgent = await tx.agent.findUnique({ where: { id: order.agentId } });
          if (oldAgent) {
            const decCapacity = Math.max(0, oldAgent.activeCount - 1);
            await tx.agent.update({
              where: { id: order.agentId },
              data: { activeCount: decCapacity, status: 'AVAILABLE' }
            });
          }
        }

        const agent = await tx.agent.findUnique({ where: { id: agentId } });
        if (!agent) throw new Error('Agent not found.');
        if (agent.status === 'OFFLINE') throw new Error('Agent is offline.');
        if (agent.activeCount >= agent.maxConcurrent) throw new Error('Agent has reached capacity.');

        // Increment active Count
        const newActiveCount = agent.activeCount + 1;
        const newStatus = newActiveCount >= agent.maxConcurrent ? 'BUSY' : 'AVAILABLE';

        await tx.agent.update({
          where: { id: agentId },
          data: { activeCount: newActiveCount, status: newStatus }
        });

        await tx.order.update({
          where: { id },
          data: { agentId, currentStatus: 'ASSIGNED' }
        });

        await tx.orderStatusHistory.create({
          data: {
            orderId: id,
            status: 'ASSIGNED',
            actorRole: 'ADMIN',
            actorId: req.user!.id,
            notes: order.agentId 
              ? `Re-assigned agent from ${order.agentId} to ${agentId}`
              : `Manually assigned agent: ${agentId}`
          }
        });
      });
    }

    const order = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        agent: { include: { user: true } },
        statusHistory: { orderBy: { timestamp: 'desc' } }
      }
    });

    if (order) {
      emitOrderUpdate(order.id, order);
      await sendEmailNotification(order.id, order.customerId, order.customer.email, 'ASSIGNED', `Agent assigned: ${order.agent?.user?.email || assignedAgentId}`);
      if (order.agent?.user?.email) {
        await sendAgentAssignmentEmail(order.id, order.agent.user.email, order.pickupPincode, order.dropPincode);
      }
    }

    res.json(order);
  } catch (error: any) {
    res.status(400).json({ error: error.message || 'Failed to assign agent.' });
  }
});

/**
 * @openapi
 * /orders/{id}/status:
 *   post:
 *     summary: Update order status
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/status', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { status, notes } = StatusUpdateSchema.parse(req.body);
    const user = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true, agent: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    // Role verification
    if (user.role === 'AGENT') {
      const agentProfile = await prisma.agent.findUnique({ where: { userId: user.id } });
      if (!agentProfile || order.agentId !== agentProfile.id) {
        return res.status(403).json({ error: 'Forbidden: You can only update statuses for orders assigned to you.' });
      }
    } else if (user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Only admins and assigned agents can update status.' });
    }

    // Update in transaction
    const updatedOrder = await prisma.$transaction(async (tx) => {
      const nextOrder = await tx.order.update({
        where: { id },
        data: { currentStatus: status }
      });

      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status,
          actorRole: user.role,
          actorId: user.id,
          notes: notes || `Status updated to ${status}.`
        }
      });

      // Release agent capacity if order terminates (DELIVERED, FAILED)
      if ((status === 'DELIVERED' || status === 'FAILED') && order.agentId) {
        const agent = await tx.agent.findUnique({ where: { id: order.agentId } });
        if (agent) {
          const newActiveCount = Math.max(0, agent.activeCount - 1);
          // If status was OFFLINE, keep it offline, else make it AVAILABLE
          const newStatus = agent.status === 'OFFLINE' ? 'OFFLINE' : 'AVAILABLE';

          await tx.agent.update({
            where: { id: agent.id },
            data: {
              activeCount: newActiveCount,
              status: newStatus
            }
          });
        }
      }

      return nextOrder;
    });

    const finalOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        agent: { include: { user: true } },
        statusHistory: { orderBy: { timestamp: 'desc' } }
      }
    });

    if (finalOrder) {
      emitOrderUpdate(finalOrder.id, finalOrder);
      await sendEmailNotification(finalOrder.id, finalOrder.customerId, finalOrder.customer.email, status, notes);
    }

    res.json(finalOrder);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Update status error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

/**
 * @openapi
 * /orders/{id}/reschedule:
 *   post:
 *     summary: Reschedule a failed order
 *     tags: [Orders]
 *     security:
 *       - bearerAuth: []
 */
router.post('/:id/reschedule', authenticateJWT, async (req: AuthRequest, res: Response) => {
  try {
    const { id } = req.params;
    const { requestedDate } = RescheduleSchema.parse(req.body);
    const user = req.user!;

    const order = await prisma.order.findUnique({
      where: { id },
      include: { customer: true }
    });

    if (!order) {
      return res.status(404).json({ error: 'Order not found.' });
    }

    if (order.customerId !== user.id && user.role !== 'ADMIN') {
      return res.status(403).json({ error: 'Forbidden: Only the customer or an admin can reschedule.' });
    }

    if (order.currentStatus !== 'FAILED') {
      return res.status(400).json({ error: 'Order can only be rescheduled if it is in FAILED status.' });
    }

    // Perform reschedule in transaction
    const finalOrder = await prisma.$transaction(async (tx) => {
      // 1. Create Reschedule Request
      await tx.rescheduleRequest.create({
        data: {
          orderId: id,
          requestedDate,
          createdBy: user.id
        }
      });

      // 2. Unassign current agent if any, and set status to PLACED (to trigger re-assignment)
      const nextOrder = await tx.order.update({
        where: { id },
        data: {
          currentStatus: 'PLACED',
          agentId: null
        }
      });

      // 3. Write status history
      await tx.orderStatusHistory.create({
        data: {
          orderId: id,
          status: 'PLACED',
          actorRole: user.role,
          actorId: user.id,
          notes: `Rescheduled for ${requestedDate.toLocaleDateString()}. Re-queued for assignment.`
        }
      });

      return nextOrder;
    });

    // Send reschedule notification
    await sendEmailNotification(id, order.customerId, order.customer.email, 'PLACED', `Delivery rescheduled for ${requestedDate.toLocaleDateString()}`);

    // Trigger auto-assignment of a new agent for the new attempt
    try {
      await autoAssignOrder(id);
      console.log(`Auto-assigned order ${id} after rescheduling.`);
    } catch (assignError: any) {
      console.log(`Failed auto-assignment post-rescheduling: ${assignError.message}. Retaining PLACED status.`);
    }

    const updatedOrder = await prisma.order.findUnique({
      where: { id },
      include: {
        customer: true,
        agent: { include: { user: true } },
        statusHistory: { orderBy: { timestamp: 'desc' } }
      }
    });

    if (updatedOrder) {
      emitOrderUpdate(updatedOrder.id, updatedOrder);
      if (updatedOrder.agent?.user?.email) {
        await sendEmailNotification(updatedOrder.id, updatedOrder.customerId, updatedOrder.customer.email, 'ASSIGNED', `Agent auto-assigned on reschedule: ${updatedOrder.agent.user.email}`);
        await sendAgentAssignmentEmail(updatedOrder.id, updatedOrder.agent.user.email, updatedOrder.pickupPincode, updatedOrder.dropPincode);
      }
    }

    res.json(updatedOrder);
  } catch (error: any) {
    if (error instanceof z.ZodError) {
      return res.status(400).json({ error: error.errors });
    }
    console.error('Reschedule error:', error);
    res.status(500).json({ error: 'Internal Server Error' });
  }
});

export default router;

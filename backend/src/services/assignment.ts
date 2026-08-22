import prisma from '../config/prisma';
import { getHaversineDistance } from '../utils/distance';

/**
 * Auto-assigns an order to the best available agent using a combination of distance and load balancing.
 * Wrapped in a database transaction with optional row-locking.
 */
export async function autoAssignOrder(orderId: string): Promise<string> {
  return await prisma.$transaction(async (tx) => {
    // 1. Fetch order details
    const order = await tx.order.findUnique({
      where: { id: orderId }
    });
    if (!order) {
      throw new Error(`Order with ID ${orderId} not found.`);
    }
    if (order.agentId) {
      throw new Error(`Order ${orderId} is already assigned to agent ${order.agentId}.`);
    }

    // Resolve pickup pincode mapping to find the pickup zone
    const pickupMapping = await tx.areaZoneMapping.findUnique({
      where: { pincode: order.pickupPincode }
    });
    if (!pickupMapping) {
      throw new Error(`Pickup area mapping not found for pincode ${order.pickupPincode}.`);
    }
    const zoneId = pickupMapping.zoneId;

    // 2. Fetch candidate agents who cover this zone and are active/available
    const agents = await tx.agent.findMany({
      where: {
        status: 'AVAILABLE'
      }
    });

    // Filter agents whose zone coverage contains the zone ID and who have capacity headroom
    const candidateAgents = agents.filter((agent) => {
      const coverageList = agent.zoneCoverage.split(',').map((z) => z.trim());
      const hasCoverage = coverageList.includes(zoneId) || coverageList.includes(order.pickupPincode);
      const hasCapacity = agent.activeCount < agent.maxConcurrent;
      return hasCoverage && hasCapacity;
    });

    if (candidateAgents.length === 0) {
      throw new Error('No available agents cover this zone or have active capacity.');
    }

    // 3. Compute score: score = distance * loadFactor
    // loadFactor = 1 + (activeCount / maxConcurrent)
    // distance is Haversine distance from agent coordinates to order pickup coordinates
    const agentsWithScores = candidateAgents.map((agent) => {
      const distance = getHaversineDistance(
        agent.currentLat,
        agent.currentLng,
        order.pickupLat,
        order.pickupLng
      );
      const loadFactor = 1 + agent.activeCount / agent.maxConcurrent;
      const score = distance * loadFactor;
      return { agent, distance, score };
    });

    // Sort by score ascending (lowest score is best)
    agentsWithScores.sort((a, b) => a.score - b.score);
    const bestCandidate = agentsWithScores[0].agent;

    // 4. Concurrency Safety: Lock the selected agent row for update if using Postgres
    const isPostgres = process.env.DATABASE_URL?.startsWith('postgres');
    if (isPostgres) {
      await tx.$executeRawUnsafe(
        `SELECT id FROM "Agent" WHERE id = $1 FOR UPDATE`,
        bestCandidate.id
      );
    }

    // 5. Update agent active order count and status
    const newActiveCount = bestCandidate.activeCount + 1;
    const newStatus = newActiveCount >= bestCandidate.maxConcurrent ? 'BUSY' : 'AVAILABLE';

    await tx.agent.update({
      where: { id: bestCandidate.id },
      data: {
        activeCount: newActiveCount,
        status: newStatus
      }
    });

    // 6. Update order status and set agentId
    await tx.order.update({
      where: { id: orderId },
      data: {
        agentId: bestCandidate.id,
        currentStatus: 'ASSIGNED'
      }
    });

    // 7. Write to order status history (audit log)
    // Since this is a system assignment, we link actor to system/admin user
    // We try to find the first admin user in the system to set as actor, or fallback to the customer
    const firstAdmin = await tx.user.findFirst({ where: { role: 'ADMIN' } });
    const actorId = firstAdmin ? firstAdmin.id : order.customerId;
    const actorRole = firstAdmin ? 'ADMIN' : 'SYSTEM';

    await tx.orderStatusHistory.create({
      data: {
        orderId: order.id,
        status: 'ASSIGNED',
        actorRole: actorRole,
        actorId: actorId,
        notes: `System auto-assigned agent: ${bestCandidate.id} (Distance: ${agentsWithScores[0].distance.toFixed(
          2
        )} km, Load Factor: ${agentsWithScores[0].agent.activeCount}/${agentsWithScores[0].agent.maxConcurrent})`
      }
    });

    return bestCandidate.id;
  });
}

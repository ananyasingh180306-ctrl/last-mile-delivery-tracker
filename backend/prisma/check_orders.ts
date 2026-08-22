import { PrismaClient } from '@prisma/client';

const prisma = new PrismaClient();

async function main() {
  console.log('Querying orders...');
  const orders = await prisma.order.findMany({
    include: {
      customer: true,
      agent: { include: { user: true } },
      statusHistory: true
    }
  });

  console.log('Orders count:', orders.length);
  for (const order of orders) {
    console.log(`Order ID: ${order.id}`);
    console.log(`Status: ${order.currentStatus}`);
    console.log(`Agent ID: ${order.agentId}`);
    console.log(`Agent:`, order.agent);
    console.log(`chargeBreakdown (type: ${typeof order.chargeBreakdown}):`, order.chargeBreakdown);
    try {
      const parsed = JSON.parse(order.chargeBreakdown);
      console.log('Parsed successfully:', parsed);
    } catch (e: any) {
      console.error('Failed to parse:', e.message);
    }
  }
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

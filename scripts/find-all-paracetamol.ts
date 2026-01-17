/**
 * Find ALL Paracetamol products (any spelling)
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
const adapter = new PrismaNeon({ connectionString: connectionString! });
const prisma = new PrismaClient({ adapter });

async function findAll() {
  console.log('🔍 Finding ALL Paracetamol products (any spelling)...\n');

  const all = await prisma.product.findMany({
    where: {
      OR: [
        { name: { contains: 'Paracetamol', mode: 'insensitive' } },
        { name: { contains: 'Paracétamol', mode: 'insensitive' } },
      ],
    },
    include: {
      batches: {
        orderBy: { expirationDate: 'asc' },
      },
    },
    orderBy: { id: 'asc' },
  });

  console.log(`Found ${all.length} products:\n`);

  all.forEach((p) => {
    console.log(`ID: ${p.id} | Name: "${p.name}" | Stock: ${p.stock}`);
    console.log(`  Batches: ${p.batches.length}`);
    p.batches.forEach((b) => {
      console.log(`    - Lot ${b.lotNumber}: ${b.quantity} units`);
    });
    console.log('');
  });

  await prisma.$disconnect();
}

findAll();

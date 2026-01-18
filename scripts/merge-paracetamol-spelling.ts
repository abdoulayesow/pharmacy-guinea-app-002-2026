/**
 * Merge Paracetamol Spelling Variants
 *
 * Merges "Paracetamol" and "Paracétamol" into one product
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

async function mergeParacetamol() {
  console.log('🔄 Merging Paracetamol Spelling Variants\n');

  const variants = await prisma.product.findMany({
    where: {
      OR: [
        { name: 'Paracetamol 500mg' },
        { name: 'Paracétamol 500mg' },
      ],
    },
    include: {
      batches: true,
      saleItems: true,
      stockMovements: true,
    },
    orderBy: { id: 'asc' },
  });

  if (variants.length === 0) {
    console.log('❌ No Paracetamol products found');
    return;
  }

  if (variants.length === 1) {
    console.log('✅ Only one Paracetamol product exists');
    return;
  }

  console.log(`Found ${variants.length} variants:\n`);
  variants.forEach((v) => {
    console.log(`  ID: ${v.id} | Name: "${v.name}" | Batches: ${v.batches.length}`);
  });

  const productToKeep = variants.find((v) => v.batches.length > 0) || variants[0];
  const productToDelete = variants.find((v) => v.id !== productToKeep.id);

  if (!productToDelete) {
    console.log('\n✅ No merge needed');
    return;
  }

  console.log(`\n✅ KEEP: ID ${productToKeep.id} - "${productToKeep.name}"`);
  console.log(`❌ DELETE: ID ${productToDelete.id} - "${productToDelete.name}"`);

  // Migrate
  if (productToDelete.saleItems.length > 0) {
    await prisma.saleItem.updateMany({
      where: { productId: productToDelete.id },
      data: { productId: productToKeep.id },
    });
    console.log(`  ✓ Migrated ${productToDelete.saleItems.length} sale items`);
  }

  if (productToDelete.stockMovements.length > 0) {
    await prisma.stockMovement.updateMany({
      where: { productId: productToDelete.id },
      data: { productId: productToKeep.id },
    });
    console.log(`  ✓ Migrated ${productToDelete.stockMovements.length} stock movements`);
  }

  // Delete
  await prisma.product.delete({
    where: { id: productToDelete.id },
  });

  console.log(`  ✓ Deleted product ID ${productToDelete.id}`);
  console.log('\n✅ Merge complete!');

  await prisma.$disconnect();
}

mergeParacetamol();

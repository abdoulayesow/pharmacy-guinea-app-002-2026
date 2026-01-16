/**
 * Database Seed Script
 *
 * Creates initial data for Seri pharmacy app:
 * - Owner account (Mamadou)
 * - Sample products for testing
 */

import 'dotenv/config';
import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import { hash } from 'bcryptjs';

// Configure Neon WebSocket for Node.js environment
// Use dynamic import to handle ESM/CJS interop with Node.js v24
async function setupWebSocket() {
  const ws = await import('ws');
  neonConfig.webSocketConstructor = ws.default;
}

async function main() {
  console.log('🌱 Starting database seed...');

  // Setup WebSocket for Neon
  await setupWebSocket();

  // Verify DATABASE_URL is set
  const connectionString = process.env.DATABASE_URL;
  if (!connectionString) {
    throw new Error('DATABASE_URL environment variable is not set');
  }

  // Create Prisma Client with Neon adapter
  const adapter = new PrismaNeon({ connectionString });
  const prisma = new PrismaClient({ adapter });

  try {
    // Create owner accounts
    console.log('👤 Creating owner accounts...');

    const ownerPIN = '1234'; // Default PIN - CHANGE IN PRODUCTION
    const pinHash = await hash(ownerPIN, 10);

    const owners = [
      {
        id: 'owner-oumar-sow',
        name: 'Oumar Sow',
        email: 'marsow07@gmail.com',
        phone: '+224 623 45 50 66',
      },
      {
        id: 'owner-abdoulaye-sow',
        name: 'Abdoulaye Sow',
        email: 'abdoulaye.sow.1989@gmail.com',
        phone: '+336 77 47 31 63',
      },
      {
        id: 'owner-binta-bah',
        name: 'Binta Bah',
        email: 'bintabah708@yahoo.fr',
        phone: '+224 664 61 63 72',
      },
    ];

    for (const ownerData of owners) {
      const owner = await prisma.user.upsert({
        where: { id: ownerData.id },
        update: {},
        create: {
          id: ownerData.id,
          name: ownerData.name,
          email: ownerData.email,
          phone: ownerData.phone,
          pinHash,
          role: 'OWNER',
          avatar: null,
        },
      });
      console.log('✅ Owner created:', owner.name, `(${owner.email}, ${owner.phone}, PIN: 1234)`);
    }

    // Create sample products
    console.log('📦 Creating sample products...');

    const products = [
      {
        name: 'Paracétamol 500mg',
        price: 1000,
        priceBuy: 600,
        stock: 100,
        minStock: 20,
      },
      {
        name: 'Ibuprofène 400mg',
        price: 1500,
        priceBuy: 900,
        stock: 80,
        minStock: 15,
      },
      {
        name: 'Amoxicilline 500mg',
        price: 3000,
        priceBuy: 2000,
        stock: 50,
        minStock: 10,
      },
      {
        name: 'Vitamine C 1000mg',
        price: 2000,
        priceBuy: 1200,
        stock: 60,
        minStock: 15,
      },
      {
        name: 'Sirop contre la toux',
        price: 4000,
        priceBuy: 2500,
        stock: 30,
        minStock: 10,
      },
      {
        name: 'Aspirine 100mg',
        price: 800,
        priceBuy: 500,
        stock: 120,
        minStock: 25,
      },
      {
        name: 'Oméprazole 20mg',
        price: 2500,
        priceBuy: 1500,
        stock: 40,
        minStock: 10,
      },
      {
        name: 'Métronidazole 500mg',
        price: 1800,
        priceBuy: 1100,
        stock: 45,
        minStock: 12,
      },
    ];

    for (const product of products) {
      await prisma.product.create({
        data: product,
      });
    }

    console.log(`✅ Created ${products.length} sample products`);

    console.log('\n🎉 Seed completed successfully!\n');
    console.log('Login credentials (all owners):');
    console.log('  - Oumar Sow (marsow07@gmail.com)');
    console.log('  - Abdoulaye Sow (abdoulaye.sow.1989@gmail.com)');
    console.log('  - Binta Bah (bintabah708@yahoo.fr)');
    console.log('  - Default PIN for all: 1234');
    console.log('\n⚠️  Remember to change the default PINs in production!\n');

  } catch (error) {
    console.error('❌ Seed failed:', error);
    throw error;
  } finally {
    await prisma.$disconnect();
  }
}

main()
  .catch((error) => {
    console.error(error);
    process.exit(1);
  });

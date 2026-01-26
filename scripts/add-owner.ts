import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import 'dotenv/config';

// Configure Neon WebSocket for Node.js
neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL not set');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  // Check if user already exists
  const existing = await prisma.user.findUnique({
    where: { email: 'abdoulaye.sow.co@gmail.com' }
  });

  if (existing) {
    console.log('User already exists:', existing);
    return;
  }

  // Add new owner user
  const user = await prisma.user.create({
    data: {
      name: 'Ablo Sow',
      email: 'abdoulaye.sow.co@gmail.com',
      phone: '+1 281 323 8023',
      role: 'OWNER',
      mustChangePin: true,
    }
  });
  console.log('Created user:', user);

  // Show all users
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true }
  });
  console.log('\nAll users:');
  users.forEach(u => console.log(`  - ${u.name} (${u.email}) - ${u.role}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

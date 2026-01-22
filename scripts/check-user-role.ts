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
  // Check specific user
  const user = await prisma.user.findUnique({
    where: { email: 'abdoulaye.sow.1989@gmail.com' }
  });

  console.log('\n=== User Details ===');
  console.log(JSON.stringify(user, null, 2));

  // Show all users with roles
  const users = await prisma.user.findMany({
    select: { id: true, name: true, email: true, role: true }
  });

  console.log('\n=== All Users ===');
  users.forEach(u => console.log(`  ${u.role.padEnd(8)} | ${u.email} | ${u.name}`));
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

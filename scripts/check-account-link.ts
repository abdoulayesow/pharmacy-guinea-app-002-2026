import { PrismaClient } from '@prisma/client';
import { neonConfig } from '@neondatabase/serverless';
import { PrismaNeon } from '@prisma/adapter-neon';
import ws from 'ws';
import 'dotenv/config';

neonConfig.webSocketConstructor = ws;

const connectionString = process.env.DATABASE_URL_UNPOOLED || process.env.DATABASE_URL;
if (!connectionString) {
  throw new Error('DATABASE_URL not set');
}

const adapter = new PrismaNeon({ connectionString });
const prisma = new PrismaClient({ adapter });

async function main() {
  const email = 'abdoulaye.sow.1989@gmail.com';

  // Find user
  const user = await prisma.user.findUnique({
    where: { email }
  });

  console.log('\n=== User ===');
  console.log('ID:', user?.id);
  console.log('Email:', user?.email);
  console.log('Role:', user?.role);

  if (!user) {
    console.log('User not found!');
    return;
  }

  // Check Account links (OAuth providers)
  const accounts = await prisma.account.findMany({
    where: { userId: user.id }
  });

  console.log('\n=== OAuth Accounts ===');
  if (accounts.length === 0) {
    console.log('No OAuth accounts linked! This is the problem.');
    console.log('The user exists but has no Google OAuth link.');
  } else {
    accounts.forEach(acc => {
      console.log(`  Provider: ${acc.provider}`);
      console.log(`  Provider Account ID: ${acc.providerAccountId}`);
      console.log(`  User ID: ${acc.userId}`);
      console.log('---');
    });
  }

  // Check Session table
  const sessions = await prisma.session.findMany({
    where: { userId: user.id }
  });

  console.log('\n=== Sessions ===');
  console.log(`Found ${sessions.length} session(s)`);
  sessions.forEach(s => {
    console.log(`  Session Token: ${s.sessionToken.substring(0, 20)}...`);
    console.log(`  Expires: ${s.expires}`);
  });
}

main()
  .catch(console.error)
  .finally(() => prisma.$disconnect());

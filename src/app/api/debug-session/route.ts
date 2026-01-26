import { NextResponse } from 'next/server';
import { auth } from '@/auth';

export async function GET() {
  const session = await auth();

  console.log('[DEBUG] Full session:', JSON.stringify(session, null, 2));

  return NextResponse.json({
    session,
    hasSession: !!session,
    userId: session?.user?.id,
    userRole: session?.user?.role,
    userEmail: session?.user?.email,
  });
}

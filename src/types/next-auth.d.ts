import 'next-auth';
import type { DefaultSession } from 'next-auth';

declare module 'next-auth' {
  interface Session {
    user: {
      id: string;
      role: string;
      hasPin?: boolean;
      mustChangePin?: boolean;
    } & DefaultSession['user'];
  }

  interface User {
    role?: string;
    mustChangePin?: boolean;
  }
}

declare module 'next-auth/jwt' {
  interface JWT {
    id?: string;
    role?: string;
    hasPin?: boolean;
    mustChangePin?: boolean;
    accessToken?: string;
  }
}

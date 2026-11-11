import { auth } from '@/lib/better-auth/auth';
import { headers } from 'next/headers';

/** The lab API sits outside the page middleware matcher, so every handler authenticates itself. */
export async function requireUser(): Promise<{ id: string; name: string } | null> {
  try {
    const s = await auth!.api.getSession({ headers: await headers() });
    return s?.user ? { id: s.user.id, name: s.user.name } : null;
  } catch {
    return null;
  }
}

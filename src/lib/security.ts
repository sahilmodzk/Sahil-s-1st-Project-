import { headers } from 'next/headers';
import { auth } from './auth';
import { db } from './db';
import { consumeRateLimit } from './rate-limit';

export class HttpError extends Error {
  constructor(public status: number, message: string) { super(message); }
}

export async function requireUser(request?: Request) {
  const session = await auth.api.getSession({ headers: request?.headers ?? await headers() });
  if (!session) throw new HttpError(401, 'Please sign in to continue.');
  const user = await db.user.findUnique({ where: { id: session.user.id } });
  if (!user) throw new HttpError(401, 'Your account is no longer available.');
  return user;
}

/** Mutations require a same-origin browser request; never trust forwarded Host headers. */
export function checkOrigin(request: Request) {
  const expected = new URL(process.env.BETTER_AUTH_URL ?? 'http://localhost:3000').origin;
  if (request.headers.get('origin') !== expected) throw new HttpError(403, 'Request origin is not allowed.');
}

/** Shared, atomic fixed-window limiter. Records persist across workers and restarts. */
export async function rateLimit(key: string, limit: number, windowSeconds: number) {
  const result = await consumeRateLimit(key, limit, windowSeconds);
  if (!result.allowed) throw new HttpError(429, 'Too many requests. Please try again shortly.');
}

export function errorResponse(error: unknown) {
  if (error instanceof HttpError) return Response.json({ error: error.message }, { status: error.status });
  console.error('Request failed:', error instanceof Error ? error.message : 'Unknown error');
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}

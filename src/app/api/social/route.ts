import { Prisma } from '@prisma/client';
import { ZodError } from 'zod';
import { getSocial, mutateSocial, SocialError } from '@/lib/social';
import { requireUser, checkOrigin, rateLimit } from '@/lib/security';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';
function failure(error: unknown) {
  if (error instanceof ZodError) return Response.json({ error: error.issues[0]?.message ?? 'Invalid input' }, { status: 400 });
  if (error instanceof SocialError) return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Error && 'status' in error && typeof error.status === 'number') return Response.json({ error: error.message }, { status: error.status });
  if (error instanceof Prisma.PrismaClientKnownRequestError) {
    if (error.code === 'P2002') return Response.json({ error: 'That username or record is already in use' }, { status: 409 });
    if (error.code === 'P2025' || error.code === 'P2003') return Response.json({ error: 'Record not found' }, { status: 404 });
  }
  console.error('Social API failed:', error);
  return Response.json({ error: 'Something went wrong. Please try again.' }, { status: 500 });
}
export async function GET(request: Request) {
  try {
    const user = await requireUser(request);
    await rateLimit(`social:read:${user.id}`, 300, 60);
    const result = await getSocial(user, new URL(request.url).searchParams);
    return Response.json(result, { headers: { 'Cache-Control': 'private, no-store' } });
  } catch (error) { return failure(error); }
}
export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    await rateLimit(`social:write:${user.id}`, 60, 60);
    if (Number(request.headers.get('content-length') ?? 0) > 16000) throw new SocialError(413, 'Request is too large');
    const text = await request.text();
    if (Buffer.byteLength(text) > 16000) throw new SocialError(413, 'Request is too large');
    let data: unknown;
    try { data = JSON.parse(text); } catch { throw new SocialError(400, 'Invalid JSON'); }
    return Response.json(await mutateSocial(user, data));
  } catch (error) { return failure(error); }
}

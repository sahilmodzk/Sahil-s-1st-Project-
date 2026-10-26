import { readFile } from 'node:fs/promises';
import path from 'node:path';

export const runtime = 'nodejs';
export async function GET(_request: Request, context: { params: Promise<{ name: string }> }) {
  const { name } = await context.params;
  if (!/^[a-zA-Z0-9_-]{1,100}\.webp$/.test(name)) return new Response('Not found', { status: 404 });
  try {
    const image = await readFile(path.join(process.cwd(), 'uploads', name));
    return new Response(image, { headers: {
      'Content-Type': 'image/webp',
      'Cache-Control': 'public, max-age=31536000, immutable',
      'X-Content-Type-Options': 'nosniff',
      'Content-Security-Policy': "default-src 'none'; sandbox",
    } });
  } catch { return new Response('Not found', { status: 404 }); }
}

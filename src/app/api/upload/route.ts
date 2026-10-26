import { mkdir, writeFile } from 'node:fs/promises';
import { randomUUID } from 'node:crypto';
import path from 'node:path';
import sharp from 'sharp';
import { checkOrigin, errorResponse, HttpError, rateLimit, requireUser } from '@/lib/security';

export const runtime = 'nodejs';
const MAX_BODY = 6 * 1024 * 1024;
const MAX_FILE = 5 * 1024 * 1024;

export async function POST(request: Request) {
  try {
    checkOrigin(request);
    const user = await requireUser(request);
    await rateLimit(`upload:${user.id}`, 20, 3600);
    const length = Number(request.headers.get('content-length') ?? 0);
    if (length > MAX_BODY) throw new HttpError(413, 'Images must be 5 MB or smaller.');
    if (!request.headers.get('content-type')?.startsWith('multipart/form-data;')) throw new HttpError(400, 'Please select an image file.');
    const reader = request.body?.getReader();
    if (!reader) throw new HttpError(400, 'Missing upload.');
    const chunks: Uint8Array[] = [];
    let size = 0;
    for (;;) {
      const { value, done } = await reader.read();
      if (done) break;
      size += value.length;
      if (size > MAX_BODY) { await reader.cancel(); throw new HttpError(413, 'Images must be 5 MB or smaller.'); }
      chunks.push(value);
    }
    const body = Buffer.concat(chunks);
    let form: FormData;
    try { form = await new Response(body, { headers: { 'content-type': request.headers.get('content-type')! } }).formData(); }
    catch { throw new HttpError(400, 'Invalid upload form.'); }
    const file = form.get('file');
    if (!(file instanceof File) || file.size === 0) throw new HttpError(400, 'Please select an image file.');
    if (file.size > MAX_FILE) throw new HttpError(413, 'Images must be 5 MB or smaller.');
    if (!['image/jpeg', 'image/png', 'image/webp'].includes(file.type)) throw new HttpError(400, 'Use a JPEG, PNG, or WebP image.');
    let image: Buffer;
    try {
      const input = sharp(Buffer.from(await file.arrayBuffer()), { limitInputPixels: 25_000_000, animated: false, failOn: 'warning' });
      const metadata = await input.metadata();
      if (!metadata.format || !['jpeg', 'png', 'webp'].includes(metadata.format)) throw new Error('Unsupported format');
      image = await input.rotate().resize({ width: 1600, height: 1600, fit: 'inside', withoutEnlargement: true }).webp({ quality: 85 }).toBuffer();
    } catch { throw new HttpError(400, 'This image could not be processed. Use a valid JPEG, PNG, or WebP under 25 megapixels.'); }
    const directory = path.join(process.cwd(), 'uploads');
    await mkdir(directory, { recursive: true });
    const name = `${randomUUID()}.webp`;
    await writeFile(path.join(directory, name), image, { flag: 'wx', mode: 0o644 });
    return Response.json({ url: `/api/media/${name}` }, { status: 201 });
  } catch (error) { return errorResponse(error); }
}

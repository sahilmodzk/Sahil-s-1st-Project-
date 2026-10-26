import { createHash } from 'node:crypto';
import { db } from './db';

/** One atomic PostgreSQL statement protects concurrent requests across all app workers. */
export async function consumeRateLimit(key: string, limit: number, windowSeconds: number) {
  const id = createHash('sha256').update(key).digest('hex');
  const now = BigInt(Date.now());
  const cutoff = now - BigInt(windowSeconds * 1000);
  const rows = await db.$queryRaw<{ count: number; lastRequest: bigint }[]>`
    INSERT INTO "RateLimit" (id, count, "lastRequest") VALUES (${id}, 1, ${now})
    ON CONFLICT (id) DO UPDATE SET
      count = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN 1 ELSE LEAST("RateLimit".count + 1, 1000000) END,
      "lastRequest" = CASE WHEN "RateLimit"."lastRequest" <= ${cutoff} THEN ${now} ELSE "RateLimit"."lastRequest" END
    RETURNING count, "lastRequest"`;
  const row = rows[0];
  return {
    allowed: row.count <= limit,
    retryAfter: row.count > limit ? Math.max(1, Math.ceil(Number(row.lastRequest + BigInt(windowSeconds * 1000) - now) / 1000)) : null,
  };
}

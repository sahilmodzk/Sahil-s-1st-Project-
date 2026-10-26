import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createHash, randomUUID } from 'node:crypto';
import { consumeRateLimit } from '../src/lib/rate-limit';
import { db } from '../src/lib/db';

test('database limiter permits exactly its quota across concurrent requests and resets expired windows', async () => {
  const key = `test:${randomUUID()}`;
  const id = createHash('sha256').update(key).digest('hex');
  try {
    const results = await Promise.all(Array.from({ length: 12 }, () => consumeRateLimit(key, 4, 60)));
    assert.equal(results.filter(result => result.allowed).length, 4);
    assert.ok(results.filter(result => !result.allowed).every(result => (result.retryAfter ?? 0) > 0));
    assert.equal((await db.rateLimit.findUniqueOrThrow({where:{id}})).count, 12);
    await db.rateLimit.update({where:{id},data:{lastRequest:BigInt(Date.now()-61_000)}});
    assert.equal((await consumeRateLimit(key,4,60)).allowed,true);
    assert.equal((await db.rateLimit.findUniqueOrThrow({where:{id}})).count,1);
  } finally {
    await db.rateLimit.deleteMany({where:{id}});
    await db.$disconnect();
  }
});

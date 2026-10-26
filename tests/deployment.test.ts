import { test } from 'node:test';
import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';

const configuration = {
  DATABASE_URL: 'postgresql://deployment:example_password@database.example.test/gather',
  BETTER_AUTH_SECRET: 'a'.repeat(64),
  BETTER_AUTH_URL: 'https://gather.example.test',
};
function validate(overrides: Record<string, string>) {
  return spawnSync(process.execPath, ['scripts/validate-cloud-env.mjs'], {
    encoding: 'utf8', env: { ...process.env, ...configuration, ...overrides },
  });
}

test('deployment rejects incomplete database strings before the PostgreSQL driver can invent a host', () => {
  for (const value of ['', 'database', 'a-database-name', '"postgresql://user:password@database.example.test/gather"']) {
    const result = validate({ DATABASE_URL: value });
    assert.equal(result.status, 1);
    assert.match(result.stderr, /Configuration error:.*DATABASE_URL/);
    assert.ok(!result.stderr.includes(configuration.BETTER_AUTH_SECRET));
    if (value) assert.ok(!result.stderr.includes(value));
  }
});

test('deployment explains an invalid website address without leaking a misplaced secret', () => {
  const misplacedSecret = 'b'.repeat(64);
  const result = validate({ BETTER_AUTH_URL: misplacedSecret });
  assert.equal(result.status, 1);
  assert.match(result.stderr, /BETTER_AUTH_URL/);
  assert.ok(!result.stderr.includes(misplacedSecret));
  assert.ok(!result.stderr.includes('ERR_INVALID_URL'));
});

test('deployment accepts complete cloud settings and logs only noncredential database metadata', () => {
  const result = validate({});
  assert.equal(result.status, 0);
  assert.match(result.stdout, /database\.example\.test/);
  assert.ok(!result.stdout.includes('example_password'));
  assert.ok(!result.stdout.includes(configuration.BETTER_AUTH_SECRET));
});

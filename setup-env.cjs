async function main() {
  const fs = await import('node:fs');
  if (fs.existsSync('.env')) {
    console.log('Existing .env preserved.');
    return;
  }
  const { randomBytes } = await import('node:crypto');
  const template = fs.readFileSync('.env.example', 'utf8');
  fs.writeFileSync('.env', template.replace('replace-with-a-random-secret-at-least-32-characters', randomBytes(32).toString('hex')), { flag: 'wx', mode: 0o600 });
  console.log('Local environment configured.');
}
main().catch(error => { console.error(error.message); process.exitCode = 1; });

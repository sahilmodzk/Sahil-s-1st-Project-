import { pathToFileURL } from 'node:url';

export function validateCloudEnv(env) {
  if (!env.DATABASE_URL) throw new Error('Set DATABASE_URL to the complete connection URL from your database service.');
  let database;
  try { database = new URL(env.DATABASE_URL); }
  catch { throw new Error('DATABASE_URL is not a complete PostgreSQL URL. Copy the entire Internal Database URL into the web service environment, then save and redeploy.'); }
  if (!['postgres:', 'postgresql:'].includes(database.protocol) || !database.hostname || !database.username || database.pathname.length < 2) {
    throw new Error('DATABASE_URL must include the PostgreSQL protocol, username, server, and database name. Copy the entire connection URL from your database service.');
  }
  if (!env.BETTER_AUTH_SECRET || env.BETTER_AUTH_SECRET.length < 32 || env.BETTER_AUTH_SECRET.startsWith('replace-')) {
    throw new Error('Set BETTER_AUTH_SECRET to an independent random secret of at least 32 characters.');
  }
  let website;
  try { website = new URL(env.BETTER_AUTH_URL); }
  catch { throw new Error('Set BETTER_AUTH_URL to your website’s complete HTTPS address, not the authentication secret.'); }
  if ((website.protocol !== 'https:' && !(website.protocol === 'http:' && ['localhost', '127.0.0.1'].includes(website.hostname))) || website.username || website.password || website.pathname !== '/' || website.search || website.hash) {
    throw new Error('BETTER_AUTH_URL must be your website’s HTTPS origin with no credentials, path, query, or fragment.');
  }
  return { databaseHost: database.hostname };
}

if (process.argv[1] && import.meta.url === pathToFileURL(process.argv[1]).href) {
  try {
    const result = validateCloudEnv(process.env);
    console.log(`Database URL validated (host: ${result.databaseHost}).`);
  } catch (error) {
    // Never echo a supplied URL: it may contain a password or a misplaced secret.
    console.error(`Configuration error: ${error.message}`);
    process.exitCode = 1;
  }
}

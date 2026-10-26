#!/bin/sh
set -eu
: "${DATABASE_URL:?Set DATABASE_URL to your PostgreSQL connection string}"
: "${BETTER_AUTH_URL:?Set BETTER_AUTH_URL to your public HTTPS website origin}"
: "${BETTER_AUTH_SECRET:?Set a random BETTER_AUTH_SECRET of at least 32 characters}"
node --input-type=module <<'NODE'
const secret = process.env.BETTER_AUTH_SECRET;
if (secret.length < 32 || secret.startsWith('replace-')) throw new Error('Use a random authentication secret of at least 32 characters.');
const url = new URL(process.env.BETTER_AUTH_URL);
if (url.protocol !== 'https:' && !['localhost', '127.0.0.1'].includes(url.hostname)) throw new Error('Your public website must use HTTPS.');
NODE
npm run db:migrate
exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0

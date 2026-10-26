#!/bin/sh
set -eu
node scripts/validate-cloud-env.mjs
npm run db:migrate
exec node node_modules/next/dist/bin/next start --hostname 0.0.0.0

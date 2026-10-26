// Prisma's engine-free client generator needs no native migration-engine download.
// Pin @prisma/internals to the CLI version because this programmatic API is internal.
import internals from '@prisma/internals';
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { PrismaClientJsGenerator } = require('@prisma/client-generator-js');
const generators = await internals.getGenerators({
  schemaPath: 'prisma/schema.prisma',
  registry: { 'prisma-client-js': { type: 'in-process', generator: new PrismaClientJsGenerator({ cliCommand: 'npm run db:generate' }) } },
  skipDownload: true,
  cliCommand: 'npm run db:generate',
});
try {
  for (const generator of generators) await generator.generate();
  console.log('Prisma engine-free PostgreSQL client generated.');
} finally {
  for (const generator of generators) generator.stop();
}

import 'dotenv/config';
import { readFile } from 'node:fs/promises';
import { createRequire } from 'node:module';
import { pathToFileURL } from 'node:url';
import { PrismaPg } from '@prisma/adapter-pg';
import { bindMigrationAwareSqlAdapterFactory } from '@prisma/driver-adapter-utils';
const require = createRequire(import.meta.url);
export async function createEngine() {
  if (!process.env.DATABASE_URL) throw new Error('Set DATABASE_URL in .env before running database commands.');
  const runtime = await import('@prisma/schema-engine-wasm/schema_engine_bg');
  const bytes = await readFile(new URL('./schema_engine_bg.wasm', pathToFileURL(require.resolve('@prisma/schema-engine-wasm'))));
  const wasm = await WebAssembly.instantiate(bytes, { './schema_engine_bg.js': runtime });
  runtime.__wbg_set_wasm(wasm.instance.exports);
  wasm.instance.exports.__wbindgen_start();
  return runtime.SchemaEngine.new({ datamodels: undefined }, () => {}, bindMigrationAwareSqlAdapterFactory(new PrismaPg({connectionString:process.env.DATABASE_URL})));
}
export const filters = { externalTables: [], externalEnums: [] };

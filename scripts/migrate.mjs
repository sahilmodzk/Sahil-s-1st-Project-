// Run the real Prisma migration engine as WASM, avoiding native-engine downloads.
// These version-pinned internal Prisma APIs share the standard _prisma_migrations history.
import {createEngine,filters} from './prisma-engine.mjs';
import {readFile,readdir} from 'node:fs/promises';
import path from 'node:path';
const baseDir=path.resolve('prisma/migrations');
const directories=(await readdir(baseDir,{withFileTypes:true})).filter(d=>d.isDirectory()).map(d=>d.name).sort();
const engine=await createEngine();
try {
 const result=await engine.applyMigrations({migrationsList:{baseDir,lockfile:{path:'migration_lock.toml',content:await readFile(path.join(baseDir,'migration_lock.toml'),'utf8')},shadowDbInitScript:'',migrationDirectories:await Promise.all(directories.map(async name=>({path:name,migrationFile:{path:'migration.sql',content:{tag:'ok',value:await readFile(path.join(baseDir,name,'migration.sql'),'utf8')}}})))},filters});
 console.log(result.appliedMigrationNames.length?`Applied migrations: ${result.appliedMigrationNames.join(', ')}`:'Database migrations are up to date.');
} finally { engine.free(); }

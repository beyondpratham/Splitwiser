// Checks supabase/schema.sql works on an empty project, on a project that already has some of it,
// and when run twice. Usage: node scripts/test-schema.mjs (part of npm test)
import assert from 'node:assert/strict';
import { cpSync, mkdirSync, mkdtempSync, readdirSync, readFileSync, rmSync } from 'node:fs';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { openDatabase } from './lib/local-db.mjs';

const schema = readFileSync('supabase/schema.sql', 'utf8');
const check = readFileSync('supabase/check.sql', 'utf8');
const migrations = readdirSync('supabase/migrations').filter((f) => f.endsWith('.sql')).sort();

/** A database with only the first `count` migrations applied. */
async function databaseWith(count) {
  const dir = mkdtempSync(join(tmpdir(), 'splitwiser-schema-'));
  mkdirSync(join(dir, 'm'));
  for (const f of migrations.slice(0, count)) cpSync(join('supabase/migrations', f), join(dir, 'm', f));
  const db = await openDatabase({ migrationsDir: join(dir, 'm') });
  rmSync(dir, { recursive: true, force: true });
  return db;
}

async function allChecksPass(db, label) {
  const { rows } = await db.query(check);
  const failed = rows.filter((r) => !r.ok).map((r) => r.item);
  assert.deepEqual(failed, [], `${label}: failing checks`);
}

for (const [count, label] of [
  [0, 'an empty project'],
  [5, 'a project with the first five updates'],
  [migrations.length, 'a project that already has everything'],
]) {
  const db = await databaseWith(count);
  await db.exec(schema);
  await db.exec(schema); // and once more
  await allChecksPass(db, label);
  console.log(`  ✓ schema.sql on ${label} (run twice)`);
}
console.log('✓ schema.sql is safe to paste');

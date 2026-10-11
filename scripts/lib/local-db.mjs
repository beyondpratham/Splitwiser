// Shared helpers for running the real Supabase migrations on PGlite (Postgres compiled to WASM),
// with a minimal stand-in for Supabase's `auth` schema. Used by the DB tests and the local backend.
import { PGlite } from '@electric-sql/pglite';
import { readdirSync, readFileSync } from 'node:fs';
import { join } from 'node:path';

const AUTH_STUB = `
  create role anon nologin;
  create role authenticated nologin;
  create schema auth;
  create table auth.users (
    id uuid primary key default gen_random_uuid(),
    email text unique,
    encrypted_password text,
    raw_user_meta_data jsonb default '{}',
    created_at timestamptz not null default now()
  );
  create table auth.schema_migrations (name text primary key, applied_at timestamptz not null default now());
  create function auth.uid() returns uuid language sql stable as
    $$ select nullif(current_setting('request.jwt.claim.sub', true), '')::uuid $$;
  create publication supabase_realtime;
  grant usage on schema public to anon, authenticated;
  grant usage on schema auth to anon, authenticated;
  grant execute on function auth.uid() to anon, authenticated;
  alter default privileges in schema public grant all on tables to anon, authenticated;
  alter default privileges in schema public grant all on functions to anon, authenticated;
`;

/** Opens (or creates) a database and applies any migrations it hasn't seen yet. */
export async function openDatabase({ dataDir, migrationsDir = 'supabase/migrations' } = {}) {
  // Return DATE columns as 'YYYY-MM-DD' strings, like PostgREST does (PGlite would build JS Dates).
  const options = { parsers: { 1082: (value) => value } };
  const db = dataDir ? new PGlite(dataDir, options) : new PGlite(options);
  const { rows } = await db.query(`select 1 from information_schema.schemata where schema_name = 'auth'`);
  if (rows.length === 0) await db.exec(AUTH_STUB);

  const applied = new Set((await db.query('select name from auth.schema_migrations')).rows.map((r) => r.name));
  for (const file of readdirSync(migrationsDir).filter((f) => f.endsWith('.sql')).sort()) {
    if (applied.has(file)) continue;
    try {
      await db.exec(readFileSync(join(migrationsDir, file), 'utf8'));
    } catch (e) {
      throw new Error(`Migration ${file} failed: ${e.message}`);
    }
    await db.query('insert into auth.schema_migrations (name) values ($1)', [file]);
  }
  return db;
}

/** Runs `fn(tx)` in a transaction as the given auth user, with row level security enforced. */
export function asUser(db, uid, fn) {
  return db.transaction(async (tx) => {
    await tx.query(`select set_config('request.jwt.claim.sub', $1, true)`, [uid ?? '']);
    await tx.exec(uid ? 'set local role authenticated' : 'set local role anon');
    return fn(tx);
  });
}

/** Creates an auth user (the signup trigger creates or claims their profile). */
export async function createUser(db, { email, name, passwordHash = null }) {
  const { rows } = await db.query(
    `insert into auth.users (email, encrypted_password, raw_user_meta_data) values ($1, $2, $3) returning id`,
    [email.toLowerCase(), passwordHash, { name }],
  );
  return rows[0].id;
}

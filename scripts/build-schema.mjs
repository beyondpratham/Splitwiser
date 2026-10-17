// Combines every migration into supabase/schema.sql: one file to paste into Supabase → SQL Editor.
// Each migration is written to be safe to re-run, so the file works on a new project and on one that
// already has some or all of it. Usage: npm run db:schema
import { readdirSync, readFileSync, writeFileSync } from 'node:fs';

const dir = 'supabase/migrations';
const files = readdirSync(dir).filter((f) => f.endsWith('.sql')).sort();
const parts = files.map((f) => `-- ════════ ${f} ════════\n\n${readFileSync(`${dir}/${f}`, 'utf8').trim()}\n`);

writeFileSync(
  'supabase/schema.sql',
  `-- SplitWiser database: the complete setup in one file.
-- Paste all of it into Supabase → SQL Editor → New query, and press Run.
-- Safe to run again: it only adds what's missing and refreshes the functions and rules.
-- Generated from supabase/migrations by \`npm run db:schema\`; don't edit this file by hand.

${parts.join('\n')}`,
);
console.log(`✓ supabase/schema.sql (${files.length} migrations)`);

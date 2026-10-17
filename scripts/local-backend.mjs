// A local stand-in for Supabase, so the whole app can be tried on one computer with no account,
// no Docker and nothing installed globally. It runs the real migrations (with row level security)
// on PGlite and speaks the subset of the Supabase HTTP + realtime protocols the app uses:
//
//   /auth/v1      signup, password + refresh-token sign in, user, logout, password reset by code
//   /rest/v1      PostgREST-style select / update / delete with filters, ordering and embeds; rpc calls
//   /realtime/v1  websocket: postgres_changes INSERT events for the activity table
//
// Usage: npm run local:backend [-- --reset] [-- --no-seed]
// Data lives in ./.localdb (git-ignored). Demo login: alex@demo.app / demo1234
import { createHmac, randomBytes, randomUUID, scryptSync, timingSafeEqual } from 'node:crypto';
import { existsSync, mkdirSync, readFileSync, rmSync, writeFileSync } from 'node:fs';
import http from 'node:http';
import { WebSocketServer } from 'ws';
import { asUser, createUser, openDatabase } from './lib/local-db.mjs';
import { seedDemoData } from './lib/seed.mjs';

const PORT = Number(process.env.PORT ?? 54321);
const DATA_DIR = process.env.LOCAL_DB_DIR ?? '.localdb';
const args = new Set(process.argv.slice(2));

if (args.has('--reset')) rmSync(DATA_DIR, { recursive: true, force: true });
mkdirSync(DATA_DIR, { recursive: true });

const db = await openDatabase({ dataDir: `${DATA_DIR}/pg` });
await db.exec(`create table if not exists auth.refresh_tokens (
  token text primary key, user_id uuid not null references auth.users (id) on delete cascade, created_at timestamptz default now())`);

const secretFile = `${DATA_DIR}/jwt-secret`;
if (!existsSync(secretFile)) writeFileSync(secretFile, randomBytes(32).toString('hex'));
const SECRET = readFileSync(secretFile, 'utf8');

// ─── Passwords & tokens ──────────────────────────────────────────────────────

export function hashPassword(password) {
  const salt = randomBytes(16).toString('hex');
  return `scrypt$${salt}$${scryptSync(password, salt, 32).toString('hex')}`;
}

function checkPassword(password, stored) {
  if (!stored?.startsWith('scrypt$')) return false;
  const [, salt, hash] = stored.split('$');
  const actual = scryptSync(password, salt, 32);
  return timingSafeEqual(actual, Buffer.from(hash, 'hex'));
}

const b64url = (v) => Buffer.from(typeof v === 'string' ? v : JSON.stringify(v)).toString('base64url');

function signJwt(payload) {
  const head = b64url({ alg: 'HS256', typ: 'JWT' });
  const body = b64url(payload);
  const sig = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  return `${head}.${body}.${sig}`;
}

function verifyJwt(token) {
  const [head, body, sig] = (token ?? '').split('.');
  if (!head || !body || !sig) return null;
  const expected = createHmac('sha256', SECRET).update(`${head}.${body}`).digest('base64url');
  if (expected.length !== sig.length || !timingSafeEqual(Buffer.from(expected), Buffer.from(sig))) return null;
  const payload = JSON.parse(Buffer.from(body, 'base64url').toString());
  return payload.exp * 1000 > Date.now() ? payload : null;
}

function userJson(u) {
  return {
    id: u.id,
    aud: 'authenticated',
    role: 'authenticated',
    email: u.email,
    email_confirmed_at: u.created_at,
    phone: '',
    app_metadata: { provider: 'email', providers: ['email'] },
    user_metadata: u.raw_user_meta_data ?? {},
    identities: [],
    created_at: u.created_at,
    updated_at: u.created_at,
  };
}

async function issueSession(user) {
  const now = Math.floor(Date.now() / 1000);
  const expiresIn = 3600;
  const refresh = randomBytes(24).toString('base64url');
  await db.query('insert into auth.refresh_tokens (token, user_id) values ($1, $2)', [refresh, user.id]);
  return {
    access_token: signJwt({ sub: user.id, email: user.email, role: 'authenticated', aud: 'authenticated', iat: now, exp: now + expiresIn, session_id: randomUUID() }),
    token_type: 'bearer',
    expires_in: expiresIn,
    expires_at: now + expiresIn,
    refresh_token: refresh,
    user: userJson(user),
  };
}

// ─── Demo data ───────────────────────────────────────────────────────────────

const { rows: userCount } = await db.query('select count(*)::int as n from auth.users');
if (userCount[0].n === 0 && !args.has('--no-seed')) {
  await seedDemoData(db, { hashPassword });
  console.log('✓ Seeded demo data');
}

// ─── HTTP helpers ────────────────────────────────────────────────────────────

const CORS = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, PATCH, DELETE, OPTIONS',
  'Access-Control-Allow-Headers': 'authorization, apikey, content-type, prefer, accept, accept-profile, content-profile, x-client-info, x-supabase-api-version, range',
  'Access-Control-Expose-Headers': 'content-range, x-supabase-api-version',
};

function send(res, status, body) {
  res.writeHead(status, { ...CORS, ...(body === undefined ? {} : { 'Content-Type': 'application/json' }) });
  res.end(body === undefined ? undefined : JSON.stringify(body));
}

async function readJson(req) {
  let raw = '';
  for await (const chunk of req) raw += chunk;
  return raw ? JSON.parse(raw) : {};
}

function bearerUser(req) {
  const token = (req.headers.authorization ?? '').replace(/^Bearer\s+/i, '');
  return verifyJwt(token)?.sub ?? null;
}

function pgError(res, e) {
  send(res, e.code === '42501' ? 403 : 400, { code: e.code ?? 'PGRST000', message: e.message, details: e.detail ?? null, hint: e.hint ?? null });
}

// ─── Auth ────────────────────────────────────────────────────────────────────

const recoveryCodes = new Map(); // email → { code, expires }

async function handleAuth(req, res, path, url) {
  const authError = (status, code, msg) => send(res, status, { code: status, error_code: code, msg, error: code, error_description: msg });

  if (path === 'signup' && req.method === 'POST') {
    const { email, password, data } = await readJson(req);
    if (!email || !password || password.length < 6) return authError(422, 'weak_password', 'Password should be at least 6 characters.');
    const existing = await db.query('select id from auth.users where email = lower($1)', [email]);
    if (existing.rows.length) return authError(422, 'user_already_exists', 'User already registered');
    const id = await createUser(db, { email, name: data?.name, passwordHash: hashPassword(password) });
    const { rows } = await db.query('select * from auth.users where id = $1', [id]);
    return send(res, 200, await issueSession(rows[0]));
  }

  if (path === 'token' && req.method === 'POST') {
    const grant = url.searchParams.get('grant_type');
    const body = await readJson(req);
    if (grant === 'password') {
      const { rows } = await db.query('select * from auth.users where email = lower($1)', [body.email ?? '']);
      if (!rows[0] || !checkPassword(body.password ?? '', rows[0].encrypted_password))
        return authError(400, 'invalid_credentials', 'Invalid login credentials');
      return send(res, 200, await issueSession(rows[0]));
    }
    if (grant === 'refresh_token') {
      const { rows } = await db.query(
        'delete from auth.refresh_tokens where token = $1 returning user_id',
        [body.refresh_token ?? ''],
      );
      if (!rows[0]) return authError(400, 'refresh_token_not_found', 'Invalid Refresh Token: Refresh Token Not Found');
      const user = await db.query('select * from auth.users where id = $1', [rows[0].user_id]);
      return send(res, 200, await issueSession(user.rows[0]));
    }
    return authError(400, 'unsupported_grant_type', 'Unsupported grant type');
  }

  if (path === 'user' && req.method === 'GET') {
    const uid = bearerUser(req);
    if (!uid) return authError(401, 'bad_jwt', 'Invalid JWT');
    const { rows } = await db.query('select * from auth.users where id = $1', [uid]);
    return rows[0] ? send(res, 200, userJson(rows[0])) : authError(404, 'user_not_found', 'User not found');
  }

  // Password reset: the code is printed here instead of emailed (and readable by the UI check).
  if (path === 'recover' && req.method === 'POST') {
    const { email } = await readJson(req);
    const { rows } = await db.query('select id from auth.users where email = lower($1)', [email ?? '']);
    if (rows[0]) {
      const code = String(Math.floor(100000 + Math.random() * 900000));
      recoveryCodes.set(String(email).toLowerCase(), { code, expires: Date.now() + 15 * 60_000 });
      console.log(`✉  Password reset code for ${email}: ${code}`);
    }
    return send(res, 200, {}); // same answer either way, so emails can't be probed
  }

  if (path === 'verify' && req.method === 'POST') {
    const { email, token, type } = await readJson(req);
    const entry = recoveryCodes.get(String(email ?? '').toLowerCase());
    if (type !== 'recovery' || !entry || entry.code !== token || entry.expires < Date.now())
      return authError(403, 'otp_expired', 'Token has expired or is invalid');
    recoveryCodes.delete(String(email).toLowerCase());
    const { rows } = await db.query('select * from auth.users where email = lower($1)', [email]);
    return send(res, 200, await issueSession(rows[0]));
  }

  if (path === 'user' && req.method === 'PUT') {
    const uid = bearerUser(req);
    if (!uid) return authError(401, 'bad_jwt', 'Invalid JWT');
    const { password } = await readJson(req);
    if (password !== undefined) {
      if (password.length < 6) return authError(422, 'weak_password', 'Password should be at least 6 characters.');
      await db.query('update auth.users set encrypted_password = $1 where id = $2', [hashPassword(password), uid]);
    }
    const { rows } = await db.query('select * from auth.users where id = $1', [uid]);
    return send(res, 200, userJson(rows[0]));
  }

  if (path === '__dev/recovery-code' && req.method === 'GET') {
    return send(res, 200, { code: recoveryCodes.get((url.searchParams.get('email') ?? '').toLowerCase())?.code ?? null });
  }

  if (path === 'logout' && req.method === 'POST') {
    const uid = bearerUser(req);
    if (uid) await db.query('delete from auth.refresh_tokens where user_id = $1', [uid]);
    return send(res, 204);
  }

  return authError(404, 'not_found', `No auth route ${path}`);
}

// ─── REST (PostgREST subset) ─────────────────────────────────────────────────

const IDENT = /^[a-z_][a-z0-9_]*$/;
const ident = (s) => {
  if (!IDENT.test(s)) throw Object.assign(new Error(`Invalid identifier: ${s}`), { code: 'PGRST100' });
  return `"${s}"`;
};

// Embedded resources the app asks for: parent table → { child table: foreign key column }.
const RELATIONS = {
  expenses: { expense_shares: 'expense_id' },
  groups: { group_members: 'group_id' },
};

function splitTopLevel(s) {
  const out = [];
  let depth = 0;
  let cur = '';
  for (const ch of s) {
    if (ch === '(') depth++;
    if (ch === ')') depth--;
    if (ch === ',' && depth === 0) {
      out.push(cur.trim());
      cur = '';
    } else cur += ch;
  }
  if (cur.trim()) out.push(cur.trim());
  return out;
}

function selectList(table, select) {
  return splitTopLevel(select || '*')
    .map((item) => {
      if (item === '*') return 't.*';
      const embed = item.match(/^([a-z_]+)\((.*)\)$/);
      if (embed) {
        const [, child, cols] = embed;
        const fk = RELATIONS[table]?.[child];
        if (!fk) throw Object.assign(new Error(`No relationship between ${table} and ${child}`), { code: 'PGRST200' });
        const obj =
          cols.trim() === '*'
            ? 'c'
            : `json_build_object(${splitTopLevel(cols)
                .map((c) => `'${c}', c.${ident(c)}`)
                .join(', ')})`;
        return `(select coalesce(json_agg(${obj}), '[]'::json) from public.${ident(child)} c where c.${ident(fk)} = t.id) as ${ident(child)}`;
      }
      return `t.${ident(item)}`;
    })
    .join(', ');
}

function parseList(v) {
  return splitTopLevel(v.replace(/^\(|\)$/g, '')).map((x) => x.replace(/^"|"$/g, ''));
}

function whereClause(params, values) {
  const parts = [];
  for (const [key, raw] of params) {
    if (['select', 'order', 'limit', 'offset', 'columns'].includes(key)) continue;
    const col = `t.${ident(key)}`;
    const dot = raw.indexOf('.');
    let op = raw.slice(0, dot);
    let val = raw.slice(dot + 1);
    let negate = false;
    if (op === 'not') {
      negate = true;
      const d2 = val.indexOf('.');
      op = val.slice(0, d2);
      val = val.slice(d2 + 1);
    }
    let sql;
    const p = () => `$${values.length}`;
    switch (op) {
      case 'eq': values.push(val); sql = `${col}::text = ${p()}`; break;
      case 'neq': values.push(val); sql = `${col}::text <> ${p()}`; break;
      case 'gt': case 'gte': case 'lt': case 'lte': {
        values.push(val);
        sql = `${col} ${{ gt: '>', gte: '>=', lt: '<', lte: '<=' }[op]} ${p()}`;
        break;
      }
      case 'in': values.push(parseList(val)); sql = `${col}::text = any(${p()}::text[])`; break;
      case 'is':
        if (!['null', 'true', 'false'].includes(val)) throw Object.assign(new Error(`Bad is value ${val}`), { code: 'PGRST100' });
        sql = `${col} is ${val}`;
        break;
      default:
        throw Object.assign(new Error(`Unsupported operator ${op}`), { code: 'PGRST100' });
    }
    parts.push(negate ? `not (${sql})` : sql);
  }
  return parts.length ? `where ${parts.join(' and ')}` : '';
}

function orderClause(order) {
  if (!order) return '';
  return (
    'order by ' +
    order
      .split(',')
      .map((o) => {
        const [col, ...mods] = o.split('.');
        return `t.${ident(col)} ${mods.includes('desc') ? 'desc' : 'asc'}${mods.includes('nullsfirst') ? ' nulls first' : mods.includes('nullslast') ? ' nulls last' : ''}`;
      })
      .join(', ')
  );
}

async function handleRest(req, res, path, url) {
  const uid = bearerUser(req);
  const params = [...url.searchParams.entries()];

  if (path.startsWith('rpc/') && req.method === 'POST') {
    const fn = path.slice(4);
    const body = await readJson(req);
    const values = [];
    const named = Object.entries(body).map(([k, v]) => {
      values.push(v);
      return `${ident(k)} => $${values.length}`;
    });
    try {
      const rows = await asUser(db, uid, async (tx) => (await tx.query(`select public.${ident(fn)}(${named.join(', ')}) as result`, values)).rows);
      const result = rows[0]?.result;
      send(res, 200, result === '' || result === undefined ? null : result);
      broadcastNewActivity();
    } catch (e) {
      pgError(res, e);
    }
    return;
  }

  const table = path;
  ident(table);

  if (req.method === 'GET') {
    const values = [];
    const select = url.searchParams.get('select');
    const limit = url.searchParams.get('limit');
    const sql = `select ${selectList(table, select)} from public.${ident(table)} t ${whereClause(params, values)} ${orderClause(url.searchParams.get('order'))} ${limit ? `limit ${Number(limit) | 0}` : ''}`;
    try {
      const rows = await asUser(db, uid, async (tx) => (await tx.query(sql, values)).rows);
      if ((req.headers.accept ?? '').includes('vnd.pgrst.object')) {
        if (rows.length !== 1)
          return send(res, 406, { code: 'PGRST116', message: 'JSON object requested, multiple (or no) rows returned', details: `The result contains ${rows.length} rows`, hint: null });
        return send(res, 200, rows[0]);
      }
      return send(res, 200, rows);
    } catch (e) {
      return pgError(res, e);
    }
  }

  if (req.method === 'PATCH' || req.method === 'DELETE') {
    const values = [];
    let sql;
    // like PostgREST, only read the rows back when asked to (they may include columns the caller can't read)
    const representation = (req.headers.prefer ?? '').includes('return=representation');
    const returning = representation ? 'returning t.*' : '';
    if (req.method === 'PATCH') {
      const body = await readJson(req);
      const sets = Object.entries(body).map(([k, v]) => {
        values.push(v);
        return `${ident(k)} = $${values.length}`;
      });
      if (!sets.length) return send(res, 400, { code: 'PGRST102', message: 'Empty update' });
      sql = `update public.${ident(table)} t set ${sets.join(', ')} ${whereClause(params, values)} ${returning}`;
    } else {
      sql = `delete from public.${ident(table)} t ${whereClause(params, values)} ${returning}`;
    }
    if (!sql.includes(' where ')) return send(res, 400, { code: '21000', message: 'A filter is required for update and delete' });
    try {
      const rows = await asUser(db, uid, async (tx) => (await tx.query(sql, values)).rows);
      broadcastNewActivity();
      return representation ? send(res, 200, rows) : send(res, 204);
    } catch (e) {
      return pgError(res, e);
    }
  }

  return send(res, 405, { code: 'PGRST105', message: `${req.method} is not supported on ${table} by the local backend` });
}

// ─── Realtime ────────────────────────────────────────────────────────────────

const sockets = new Set(); // { ws, uid, channels: Map<topic, { joinRef, bindings }> }
let lastActivityAt = (await db.query(`select coalesce(max(created_at), now()) as t from public.activity`)).rows[0].t;

function push(client, joinRef, ref, topic, event, payload) {
  client.ws.send(JSON.stringify([joinRef, ref, topic, event, payload]));
}

async function broadcastNewActivity() {
  const { rows } = await db.query('select * from public.activity where created_at > $1 order by created_at', [lastActivityAt]);
  if (!rows.length) return;
  lastActivityAt = rows[rows.length - 1].created_at;
  for (const client of sockets) {
    if (!client.uid) continue;
    const me = (await db.query('select id from public.profiles where user_id = $1', [client.uid])).rows[0]?.id;
    for (const row of rows) {
      if (!me || !row.involved.includes(me)) continue;
      for (const [topic, ch] of client.channels) {
        const ids = ch.bindings.filter((b) => b.table === 'activity' && ['INSERT', '*'].includes(b.event)).map((b) => b.id);
        if (!ids.length) continue;
        push(client, ch.joinRef, null, topic, 'postgres_changes', {
          ids,
          data: { type: 'INSERT', schema: 'public', table: 'activity', commit_timestamp: new Date().toISOString(), columns: [], record: row, errors: null },
        });
      }
    }
  }
}

// ─── Server ──────────────────────────────────────────────────────────────────

const server = http.createServer(async (req, res) => {
  if (req.method === 'OPTIONS') return send(res, 204);
  const url = new URL(req.url, `http://${req.headers.host}`);
  const started = Date.now();
  try {
    if (url.pathname.startsWith('/auth/v1/')) await handleAuth(req, res, url.pathname.slice(9), url);
    else if (url.pathname.startsWith('/rest/v1/')) await handleRest(req, res, url.pathname.slice(9), url);
    else if (url.pathname === '/' || url.pathname === '/health') send(res, 200, { ok: true, name: 'SplitWiser local backend' });
    else send(res, 404, { message: 'Not found' });
  } catch (e) {
    send(res, 500, { message: e.message });
  }
  if (process.env.LOG) console.log(`${req.method} ${url.pathname} ${res.statusCode} ${Date.now() - started}ms`);
});

const wss = new WebSocketServer({ noServer: true });
server.on('upgrade', (req, socket, head) => {
  if (!req.url.startsWith('/realtime/v1/websocket')) return socket.destroy();
  wss.handleUpgrade(req, socket, head, (ws) => {
    const client = { ws, uid: null, channels: new Map() };
    sockets.add(client);
    ws.on('close', () => sockets.delete(client));
    ws.on('message', (raw) => {
      let msg;
      try {
        msg = JSON.parse(raw.toString());
      } catch {
        return;
      }
      const [joinRef, ref, topic, event, payload] = msg;
      if (topic === 'phoenix' && event === 'heartbeat') return push(client, null, ref, 'phoenix', 'phx_reply', { status: 'ok', response: {} });
      if (event === 'phx_join') {
        client.uid = verifyJwt(payload?.access_token)?.sub ?? client.uid;
        const bindings = (payload?.config?.postgres_changes ?? []).map((b, i) => ({ ...b, id: i + 1 }));
        client.channels.set(topic, { joinRef, bindings });
        return push(client, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: { postgres_changes: bindings } });
      }
      if (event === 'access_token') {
        client.uid = verifyJwt(payload?.access_token)?.sub ?? client.uid;
        return;
      }
      if (event === 'phx_leave') {
        client.channels.delete(topic);
        return push(client, joinRef, ref, topic, 'phx_reply', { status: 'ok', response: {} });
      }
    });
  });
});

server.listen(PORT, () => {
  console.log(`✓ SplitWiser local backend on http://localhost:${PORT}`);
  console.log('  Demo accounts (password demo1234): alex@demo.app, sam@demo.app, priya@demo.app, jordan@demo.app');
});

// End-to-end UI check: runs the web build against a throwaway local backend in headless Chromium,
// clicks through the main flows and saves screenshots to dist/screenshots.
// Usage: npm run ui:check            (add -- --build to re-export the web bundle first)
import { execSync, spawn } from 'node:child_process';
import { createReadStream, existsSync, mkdirSync, mkdtempSync, rmSync, statSync } from 'node:fs';
import http from 'node:http';
import { tmpdir } from 'node:os';
import { extname, join, resolve } from 'node:path';

process.env.PLAYWRIGHT_BROWSERS_PATH ??= resolve('.toolchain/ms-playwright');
const { chromium } = await import('playwright');

const WEB_DIR = resolve('dist/web');
const SHOTS = resolve('dist/screenshots');
const APP_PORT = 8090;

if (process.argv.includes('--build') || !existsSync(join(WEB_DIR, 'index.html'))) {
  console.log('→ Exporting the web build…');
  execSync(`npx expo export --platform web --output-dir dist/web`, { stdio: 'inherit' });
}
rmSync(SHOTS, { recursive: true, force: true });
mkdirSync(SHOTS, { recursive: true });

// ── backend on a throwaway database ──
const dataDir = mkdtempSync(join(tmpdir(), 'splitwiser-ui-'));
const backend = spawn(process.execPath, ['scripts/local-backend.mjs'], { env: { ...process.env, LOCAL_DB_DIR: dataDir }, stdio: ['ignore', 'pipe', 'inherit'] });
await new Promise((ok, fail) => {
  backend.stdout.on('data', (d) => d.toString().includes('local backend on') && ok());
  backend.on('exit', (c) => fail(new Error(`Backend exited (${c}). Is something else using port 54321? Stop npm run local:backend first.`)));
});

// ── static server for the single-page web build ──
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.png': 'image/png', '.ico': 'image/x-icon', '.ttf': 'font/ttf', '.json': 'application/json' };
const web = http
  .createServer((req, res) => {
    const path = join(WEB_DIR, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    const file = existsSync(path) && statSync(path).isFile() ? path : join(WEB_DIR, 'index.html');
    res.writeHead(200, { 'Content-Type': TYPES[extname(file)] ?? 'application/octet-stream' });
    createReadStream(file).pipe(res);
  })
  .listen(APP_PORT);

const browser = await chromium.launch();
const errors = [];
let step = 0;
let failed = false;

async function run(name, colorScheme, flow) {
  const context = await browser.newContext({ viewport: { width: 412, height: 915 }, deviceScaleFactor: 2, colorScheme, isMobile: true, hasTouch: true });
  const page = await context.newPage();
  page.on('pageerror', (e) => errors.push(`${name}: ${e.message}`));
  page.on('console', (m) => m.type() === 'error' && !/Download the React DevTools|websocket/i.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
  page.setDefaultTimeout(15000);
  const shot = async (label) => {
    await page.waitForTimeout(700); // let entrance animations settle
    const file = `${String(++step).padStart(2, '0')}-${colorScheme}-${label}.png`;
    await page.screenshot({ path: join(SHOTS, file) });
    console.log(`  📸 ${file}`);
  };
  try {
    await page.goto(`http://localhost:${APP_PORT}/`);
    await flow(page, shot);
    console.log(`✓ ${name}`);
  } catch (e) {
    failed = true;
    console.log(`✗ ${name}: ${e.message.split('\n')[0]}`);
    await page.screenshot({ path: join(SHOTS, `FAILED-${name.replace(/\W+/g, '-')}.png`) });
  }
  await context.close();
}

// Earlier screens stay mounted (hidden) in the web stack, so only ever target visible elements.
const visible = (locator) => locator.filter({ visible: true }).first();
const text = (page, t) => visible(page.getByText(t, { exact: true }));
const button = (page, name) => visible(page.getByRole('button', { name, exact: true }));
const label = (page, l) => visible(page.getByLabel(l, { exact: true }));

async function connectAndSignIn(page, shot, email = 'alex@demo.app') {
  await text(page, 'Use local server').waitFor();
  if (shot) await shot('setup');
  await text(page, 'Use local server').click();
  await page.locator('input:visible').nth(1).waitFor();
  if (shot) await shot('sign-in');
  await page.locator('input:visible').nth(0).fill(email);
  await page.locator('input:visible').nth(1).fill('demo1234');
  await button(page, 'Sign in').click();
  await text(page, 'Your groups').waitFor();
}

await run('Onboarding, groups and balances', 'light', async (page, shot) => {
  await connectAndSignIn(page, shot);
  await shot('groups');
  await text(page, 'Flat 4B').click();
  await text(page, 'Balances').waitFor();
  await shot('group');
  await page.mouse.wheel(0, 900);
  await shot('group-scrolled');
  await text(page, 'Balances').click();
  await text(page, 'Suggested payments').waitFor();
  await shot('group-balances');
});

await run('Add an expense with a custom split', 'light', async (page, shot) => {
  await connectAndSignIn(page);
  await button(page, 'Add expense').click();
  await visible(page.getByPlaceholder('What was it for?')).waitFor();
  await visible(page.getByPlaceholder('What was it for?')).fill('Team lunch at the beach');
  await visible(page.getByPlaceholder('0.00')).fill('3600');
  await text(page, 'Choose people or a group').click();
  await text(page, 'Goa Trip').click();
  await shot('with-sheet');
  await text(page, 'Done').click();
  await text(page, 'equally').click();
  await text(page, 'Shares').waitFor();
  await shot('split-sheet');
  await text(page, 'Done').click();
  await shot('add-expense');
  await button(page, 'Save').click();
  await text(page, 'Your groups').waitFor();
  await text(page, 'Goa Trip').click();
  await text(page, 'Team lunch at the beach').waitFor();
  await shot('group-with-new-expense');
});

await run('Expense details, comments, delete and undo', 'light', async (page, shot) => {
  await connectAndSignIn(page);
  await text(page, 'Goa Trip').click();
  await text(page, 'Beach villa (3 nights)').click();
  await text(page, 'Who paid & owes').waitFor();
  await shot('expense');
  await visible(page.getByPlaceholder('Add a comment')).fill('Already planning the next trip!');
  await label(page, 'Send comment').click();
  await text(page, 'Already planning the next trip!').waitFor();
  await shot('expense-commented');
  await label(page, 'More options').click();
  await visible(page.getByRole('menuitem', { name: 'Delete' })).click();
  await button(page, 'Delete').click();
  await text(page, 'This expense was deleted').waitFor();
  await shot('expense-deleted');
  await text(page, 'Undo').click();
  await page.getByText('This expense was deleted').filter({ visible: true }).waitFor({ state: 'detached' });
});

await run('Settle up', 'light', async (page, shot) => {
  await connectAndSignIn(page);
  await text(page, 'Goa Trip').click();
  await text(page, 'Settle up').click();
  await text(page, 'Choose a balance to settle').waitFor();
  await shot('settle-choose');
  await visible(page.getByText(/owes you|you owe/)).click();
  await text(page, 'Record payment').waitFor();
  await shot('settle-form');
  await text(page, 'Record payment').click();
  await text(page, 'Settle up').waitFor();
});

await run('Friends, activity, account and insights', 'light', async (page, shot) => {
  await connectAndSignIn(page);
  await visible(page.getByRole('tab', { name: 'Friends' })).click();
  await text(page, 'Outstanding').waitFor();
  await shot('friends');
  await text(page, 'Chris Park').click();
  await text(page, 'Coffee & croissants').waitFor();
  await shot('friend');
  await label(page, 'Back').click();
  await visible(page.getByRole('tab', { name: 'Activity' })).click();
  await visible(page.getByText(/added|commented|paid/)).waitFor();
  await shot('activity');
  await visible(page.getByRole('tab', { name: 'Account' })).click();
  await text(page, 'Spending insights').waitFor();
  await shot('account');
  await text(page, 'Spending insights').click();
  await text(page, 'By category').waitFor();
  await page.waitForTimeout(800);
  await shot('insights');
});

await run('Dark theme', 'dark', async (page, shot) => {
  await connectAndSignIn(page, null, 'sam@demo.app');
  await shot('groups');
  await text(page, 'Goa Trip').click();
  await text(page, 'Balances').waitFor();
  await shot('group');
  await text(page, 'Beach villa (3 nights)').click();
  await text(page, 'Who paid & owes').waitFor();
  await shot('expense');
  await label(page, 'Back').click();
  await label(page, 'Back').click();
  await button(page, 'Add expense').click();
  await visible(page.getByPlaceholder('What was it for?')).fill('Dinner');
  await shot('add-expense');
});

await run('Delete account', 'light', async (page, shot) => {
  await connectAndSignIn(page, null, 'jordan@demo.app');
  await visible(page.getByRole('tab', { name: 'Account' })).click();
  await text(page, 'Delete account').click();
  await text(page, 'Delete your account?').waitFor();
  await shot('delete-account');
  await button(page, 'Delete account').click();
  await visible(page.locator('input')).waitFor(); // back on the sign-in screen
});

await browser.close();
web.close();
backend.kill();
rmSync(dataDir, { recursive: true, force: true });

if (errors.length) {
  console.log(`\n✗ ${errors.length} page error(s):`);
  for (const e of [...new Set(errors)].slice(0, 20)) console.log(`  - ${e}`);
}
console.log(`\nScreenshots: ${SHOTS}`);
process.exit(failed || errors.length ? 1 : 0);

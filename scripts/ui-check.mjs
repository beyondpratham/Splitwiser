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
  backend.on('exit', (c) => fail(new Error(`Backend exited (${c}). Is something else using port 54321? Stop npm run local first.`)));
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
  page.on('console', (m) => m.type() === 'error' && !/Download the React DevTools|websocket|406/i.test(m.text()) && errors.push(`${name} console: ${m.text()}`));
  page.setDefaultTimeout(15000);
  const shot = async (label) => {
    await page.waitForTimeout(800); // let entrance animations settle
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
const tab = (page, name) => visible(page.getByRole('tab', { name }));

async function connectAndSignIn(page, shot, email = 'alex@demo.app') {
  await text(page, 'Use local server').waitFor();
  if (shot) await shot('setup');
  await button(page, 'Use local server').click();
  await visible(page.getByPlaceholder('you@example.com')).waitFor();
  if (shot) await shot('sign-in');
  await visible(page.getByPlaceholder('you@example.com')).fill(email);
  await visible(page.getByPlaceholder('Your password')).fill('demo1234');
  await visible(page.getByRole('button', { name: 'Sign in', exact: true }).last()).click();
  await text(page, 'Outstanding').waitFor(); // Friends is the home tab
}

await run('Friends home, filters and a friend', 'light', async (page, shot) => {
  await connectAndSignIn(page, shot);
  await shot('friends');
  await button(page, 'You owe').click();
  await shot('friends-you-owe');
  await button(page, 'All').click();
  await text(page, 'Chris Park').click();
  await text(page, 'Coffee & croissants').waitFor();
  await shot('friend');
  await label(page, 'Back').click();
  await tab(page, 'Groups').click();
  await text(page, 'Flat 4B').waitFor();
  await shot('groups');
  await text(page, 'Flat 4B').click();
  await button(page, 'Balances').waitFor();
  await shot('group');
  await page.mouse.wheel(0, 900);
  await shot('group-scrolled');
  await button(page, 'Balances').click();
  await text(page, 'Suggested payments').waitFor();
  await shot('group-balances');
});

await run('Add an expense with a custom split', 'light', async (page, shot) => {
  await connectAndSignIn(page);
  await button(page, 'Add expense').click();
  await visible(page.getByPlaceholder('What was it for?')).fill('Team lunch at the beach');
  await label(page, 'Amount').fill('3600');
  await button(page, 'Choose people or a group').click();
  await text(page, 'Goa Trip').click();
  await shot('with-sheet');
  await button(page, 'Done').click();
  await text(page, 'equally').click();
  await button(page, 'Shares').waitFor();
  await shot('split-sheet');
  await button(page, 'Done').click();
  await shot('add-expense');
  await button(page, 'Save').click();
  await tab(page, 'Groups').click();
  await text(page, 'Goa Trip').click();
  await text(page, 'Team lunch at the beach').waitFor();
  await shot('group-with-new-expense');
});

await run('Expense details, comments, delete and undo', 'light', async (page, shot) => {
  await connectAndSignIn(page);
  await tab(page, 'Groups').click();
  await text(page, 'Goa Trip').click();
  await text(page, 'Beach villa (3 nights)').click();
  await text(page, 'Who paid & owes').waitFor();
  await shot('expense');
  await visible(page.getByPlaceholder('Add a comment')).fill('Already planning the next trip!');
  await label(page, 'Send comment').click();
  await text(page, 'Already planning the next trip!').waitFor();
  await shot('expense-commented');
  await label(page, 'More options').click();
  await button(page, 'Delete').click();
  await text(page, 'Delete this expense?').waitFor();
  await shot('confirm-dialog');
  await visible(page.getByRole('button', { name: 'Delete', exact: true }).last()).click();
  await text(page, 'This expense was deleted').waitFor();
  await shot('expense-deleted');
  await button(page, 'Undo').click();
  await page.getByText('This expense was deleted').filter({ visible: true }).waitFor({ state: 'detached' });
});

await run('Settle up', 'light', async (page, shot) => {
  await connectAndSignIn(page);
  await tab(page, 'Groups').click();
  await text(page, 'Goa Trip').click();
  await button(page, 'Settle up').click();
  await text(page, 'Choose a balance to settle').waitFor();
  await shot('settle-choose');
  await visible(page.getByText(/owes you|you owe/)).click();
  await button(page, 'Record payment').waitFor();
  await shot('settle-form');
  await button(page, 'Record payment').click();
  await button(page, 'Balances').waitFor();
});

await run('Activity and account sections', 'light', async (page, shot) => {
  await connectAndSignIn(page);
  await tab(page, 'Activity').click();
  await visible(page.getByText(/added|commented|paid/)).waitFor();
  await shot('activity');
  await label(page, 'Search activity').click();
  await visible(page.getByPlaceholder('Search activity')).fill('villa');
  await shot('activity-search');
  await tab(page, 'Account').click();
  await button(page, 'Buy me a coffee').waitFor();
  await shot('account');
  await button(page, 'Edit profile').click();
  await text(page, 'Save name').waitFor();
  await shot('profile');
  await label(page, 'Back').click();
  await text(page, 'Settings').click();
  await text(page, 'Appearance').waitFor();
  await shot('settings');
  await button(page, 'Dark').click();
  await shot('settings-dark');
  await button(page, 'Light').click();
  await label(page, 'Back').click();
  await text(page, 'Help & support').click();
  await text(page, 'Frequently asked').waitFor();
  await shot('help');
  await label(page, 'Back').click();
  await button(page, 'Buy me a coffee').click();
  await text(page, 'Enjoying SplitWiser?').waitFor();
  await shot('coffee');
  await label(page, 'Close').click();
  await tab(page, 'Groups').click();
  await label(page, 'Spending insights').click();
  await text(page, 'By category').waitFor();
  await page.waitForTimeout(800);
  await shot('insights');
});

await run('Dark theme', 'dark', async (page, shot) => {
  await connectAndSignIn(page, null, 'sam@demo.app');
  await shot('friends');
  await tab(page, 'Groups').click();
  await text(page, 'Goa Trip').click();
  await button(page, 'Balances').waitFor();
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
  await tab(page, 'Account').click();
  await text(page, 'Settings').click();
  await text(page, 'Delete account').click();
  await text(page, 'Delete your account?').waitFor();
  await shot('delete-account');
  await visible(page.getByRole('button', { name: 'Delete account', exact: true }).last()).click();
  await visible(page.getByPlaceholder('you@example.com')).waitFor(); // back on the sign-in screen
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

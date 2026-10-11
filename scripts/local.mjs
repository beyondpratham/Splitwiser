// One command to try the whole app on this computer: starts the local backend and the web app
// (with live reload) and opens it in the browser. Usage: npm run local
// In the app, tap "Use local server", then sign in with alex@demo.app / demo1234.
import { spawn } from 'node:child_process';

const children = [];
function run(name, color, command, args, { shell = false } = {}) {
  // A shell is only needed for npx on Windows; node is spawned directly (its path may contain spaces).
  const child = shell ? spawn([command, ...args].join(' '), { shell: true, env: process.env }) : spawn(command, args, { env: process.env });
  const prefix = `\x1b[${color}m[${name}]\x1b[0m `;
  const pipe = (stream, out) =>
    stream.on('data', (d) =>
      d
        .toString()
        .split(/\r?\n/)
        .filter(Boolean)
        .forEach((line) => out.write(prefix + line + '\n')),
    );
  pipe(child.stdout, process.stdout);
  pipe(child.stderr, process.stderr);
  child.on('exit', (code) => {
    console.log(`${prefix}exited (${code})`);
    shutdown();
  });
  children.push(child);
}

function shutdown() {
  for (const c of children) if (!c.killed) c.kill();
  process.exit();
}
process.on('SIGINT', shutdown);

run('backend', '32', process.execPath, ['scripts/local-backend.mjs']);
run('app', '36', 'npx', ['expo', 'start', '--web', '--port', '8081'], { shell: true });
console.log('\nOpen http://localhost:8081, tap "Use local server", then sign in with alex@demo.app / demo1234.\n');

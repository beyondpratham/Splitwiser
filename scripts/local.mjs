// One command to try the whole app on this computer: starts the local backend and the web app
// (with live reload) and opens it in the browser. Usage: npm run local
// In the app, tap "Use local server", then sign in with alex@demo.app / demo1234.
import { spawn } from 'node:child_process';

const children = [];
function run(name, color, command, args) {
  const child = spawn(command, args, { shell: process.platform === 'win32', env: process.env });
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
run('app', '36', 'npx', ['expo', 'start', '--web', '--port', '8081']);
console.log('\nOpen http://localhost:8081, tap "Use local server", then sign in with alex@demo.app / demo1234.\n');

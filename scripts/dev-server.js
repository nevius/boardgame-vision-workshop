// @ts-check
// Starts the live-reload dev server (@web/dev-server) on the right port. Run by `pnpm serve` / `pnpm dev`.
// The owner gets 8080 (reachable from Windows); agents in a sandbox get a free port in 4000–4999 on 127.0.0.1.
// Ports come from .agent/ports.conf. Port rules: scripts/dev-port.js.
import { spawn, execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import { createServer } from 'node:net';
import { createInterface } from 'node:readline/promises';
import { fileURLToPath } from 'node:url';
import { choosePort, parsePortsConf } from './dev-port.js';

/** @param {string} path */
function readText(path) {
  try {
    return readFileSync(path, 'utf8');
  } catch {
    return '';
  }
}

/**
 * True when nothing listens on the port (we can bind it ourselves).
 * @param {number} port
 * @param {string} host
 * @returns {Promise<boolean>}
 */
function canBind(port, host) {
  return new Promise((resolve) => {
    const server = createServer();
    server.once('error', () => resolve(false));
    server.listen(port, host, () => server.close(() => resolve(true)));
  });
}

/**
 * Process ids listening on a TCP port (via lsof, else ss). Empty when unknown.
 * @param {number} port
 * @returns {number[]}
 */
function holders(port) {
  const run = (/** @type {string} */ cmd, /** @type {string[]} */ args) => {
    try {
      return execFileSync(cmd, args, { encoding: 'utf8', stdio: ['ignore', 'pipe', 'ignore'] });
    } catch {
      return '';
    }
  };
  const lsof = run('lsof', ['-t', '-nP', `-iTCP:${port}`, '-sTCP:LISTEN']);
  const ids = lsof ? lsof.split(/\s+/) : [...run('ss', ['-ltnpH', `sport = :${port}`]).matchAll(/pid=(\d+)/g)].map((m) => m[1]);
  return [...new Set(ids.filter(Boolean).map(Number))];
}

/** @param {number} pid */
function describe(pid) {
  const cmd = readText(`/proc/${pid}/cmdline`).split('\0').join(' ').trim() || 'unknown command';
  const isAgent = readText(`/proc/${pid}/environ`).split('\0').includes('AGENT_RUN=1');
  return { pid, cmd, isAgent };
}

const { ownerPorts, agentRange } = parsePortsConf(readText(fileURLToPath(new URL('../.agent/ports.conf', import.meta.url))));
const env = process.env;
const choice = await choosePort({
  env,
  ownerPorts,
  agentRange,
  isFree: (port) => canBind(port, env.IS_SANDBOX === '1' && env.OWNER_DEV === '1' ? '0.0.0.0' : '127.0.0.1'),
});

if (choice.port === null) {
  console.error(`dev server: ${'error' in choice ? choice.error : 'no port'}`);
  process.exit(1);
}

if (choice.role === 'owner' && choice.busy) {
  const found = holders(choice.port).map(describe);
  if (found.length === 0) {
    console.error(`dev server: port ${choice.port} is busy, but the holder is unknown. Stop it and try again.`);
    process.exit(1);
  }
  for (const p of found) {
    console.error(`dev server: port ${choice.port} is held by pid ${p.pid} (${p.isAgent ? 'agent' : 'not an agent'}): ${p.cmd}`);
  }
  const agents = found.filter((p) => p.isAgent);
  if (agents.length < found.length || !process.stdin.isTTY) {
    console.error('dev server: only agent processes can be stopped from here. Stop the holder yourself and try again.');
    process.exit(1);
  }
  const rl = createInterface({ input: process.stdin, output: process.stderr });
  const answer = await rl.question(`Stop ${agents.length === 1 ? 'this agent process' : 'these agent processes'}? [y/N] `);
  rl.close();
  if (!/^y(es)?$/i.test(answer.trim())) process.exit(1);
  for (const p of agents) process.kill(p.pid, 'SIGTERM');
  for (let i = 0; i < 20 && !(await canBind(choice.port, choice.host)); i++) await new Promise((r) => setTimeout(r, 250));
}

const where = choice.role === 'owner' ? `http://localhost:${choice.port} (also from Windows)` : `http://127.0.0.1:${choice.port} (inside the sandbox only)`;
console.log(`dev server (${choice.role}): ${where}`);
const wds = spawn('wds', ['--root-dir', '.', '--port', String(choice.port), '--hostname', choice.host, '--watch'], {
  stdio: 'inherit',
});
wds.on('exit', (code) => process.exit(code ?? 0));
for (const sig of /** @type {const} */ (['SIGINT', 'SIGTERM'])) process.on(sig, () => wds.kill(sig));

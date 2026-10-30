// @ts-check
// Which port and address the dev server uses. Pure functions, tested in tests/dev-port.test.js.
// Owner (OWNER_DEV=1, or no sandbox): the owner port (8080). Agents in a sandbox: first free port in 4000–4999.
// Decision D-2026-10-16-dev-port-ownership (issue #42).

/**
 * Reads `.agent/ports.conf` text (KEY="value" lines, # comments).
 * @param {string} text
 * @returns {{ ownerPorts: number[], agentRange: [number, number] }}
 */
export function parsePortsConf(text) {
  /** @type {Record<string, string>} */
  const values = {};
  for (const line of text.split('\n')) {
    const m = line.match(/^\s*([A-Z_]+)\s*=\s*"?([^"#]*)"?/);
    if (m) values[m[1]] = m[2].trim();
  }
  const ownerPorts = (values.OWNER_PORTS || '').split(/[\s,]+/).filter(Boolean).map(Number);
  const range = (values.AGENT_PORT_RANGE || '4000-4999').split('-').map(Number);
  return { ownerPorts, agentRange: [range[0], range[1] ?? range[0]] };
}

/**
 * Owner or agent? OWNER_DEV=1 always means owner. AGENT_RUN=1 or a sandbox (IS_SANDBOX=1) means agent.
 * Anything else (a plain laptop) is the owner.
 * @param {Record<string, string | undefined>} env
 * @returns {'owner' | 'agent'}
 */
export function whoRuns(env) {
  if (env.OWNER_DEV === '1') return 'owner';
  if (env.AGENT_RUN === '1' || env.IS_SANDBOX === '1') return 'agent';
  return 'owner';
}

/**
 * @typedef {{ role: 'owner', port: number, host: string, busy: boolean }
 *   | { role: 'agent', port: number, host: string }
 *   | { role: 'agent', port: null, host: string, error: string }} PortChoice
 */

/**
 * Picks the port. `isFree(port)` says whether a port can be used right now.
 * Owner: the first owner port, on 0.0.0.0 inside a sandbox (so Windows reaches it), else localhost.
 * When it is busy, `busy` is true and the caller names the holder.
 * Agent: the first free port in the agent range on 127.0.0.1. Never an owner port.
 * @param {{ env: Record<string, string | undefined>, ownerPorts: number[], agentRange: [number, number],
 *   isFree: (port: number) => boolean | Promise<boolean> }} options
 * @returns {Promise<PortChoice>}
 */
export async function choosePort({ env, ownerPorts, agentRange, isFree }) {
  if (whoRuns(env) === 'owner') {
    const port = ownerPorts[0] ?? 8080;
    const host = env.IS_SANDBOX === '1' ? '0.0.0.0' : 'localhost';
    return { role: 'owner', port, host, busy: !(await isFree(port)) };
  }
  const host = '127.0.0.1';
  for (let port = agentRange[0]; port <= agentRange[1]; port++) {
    if (ownerPorts.includes(port)) continue;
    if (await isFree(port)) return { role: 'agent', port, host };
  }
  return { role: 'agent', port: null, host, error: `no free port in ${agentRange[0]}–${agentRange[1]}` };
}

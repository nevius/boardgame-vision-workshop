import assert from 'node:assert/strict';
import { choosePort, parsePortsConf, whoRuns } from '../scripts/dev-port.js';

const conf = parsePortsConf('# ports\nOWNER_PORTS="8080"\nAGENT_PORT_RANGE="4000-4999"\n');
const base = { ownerPorts: conf.ownerPorts, agentRange: conf.agentRange };
const allFree = () => true;

export function readsPortsConf() {
  assert.deepEqual(conf, { ownerPorts: [8080], agentRange: [4000, 4999] });
  assert.deepEqual(parsePortsConf(''), { ownerPorts: [], agentRange: [4000, 4999] });
}

export function tellsOwnerFromAgent() {
  assert.equal(whoRuns({}), 'owner');
  assert.equal(whoRuns({ IS_SANDBOX: '1', OWNER_DEV: '1' }), 'owner');
  assert.equal(whoRuns({ IS_SANDBOX: '1' }), 'agent');
  assert.equal(whoRuns({ AGENT_RUN: '1' }), 'agent');
}

export async function ownerGetsOwnerPort() {
  assert.deepEqual(await choosePort({ ...base, env: {}, isFree: allFree }),
    { role: 'owner', port: 8080, host: 'localhost', busy: false });
  // Inside the sandbox the owner's server listens on all addresses, so Windows reaches it.
  assert.deepEqual(await choosePort({ ...base, env: { IS_SANDBOX: '1', OWNER_DEV: '1' }, isFree: allFree }),
    { role: 'owner', port: 8080, host: '0.0.0.0', busy: false });
}

export async function ownerPortBusyIsReported() {
  const choice = await choosePort({ ...base, env: { OWNER_DEV: '1' }, isFree: (p) => p !== 8080 });
  assert.deepEqual(choice, { role: 'owner', port: 8080, host: 'localhost', busy: true });
}

export async function agentGetsFirstFreeAgentPort() {
  const env = { IS_SANDBOX: '1', AGENT_RUN: '1' };
  assert.deepEqual(await choosePort({ ...base, env, isFree: allFree }), { role: 'agent', port: 4000, host: '127.0.0.1' });
  const busy = new Set([4000, 4001]);
  assert.deepEqual(await choosePort({ ...base, env, isFree: (p) => !busy.has(p) }),
    { role: 'agent', port: 4002, host: '127.0.0.1' });
}

export async function agentNeverGetsOwnerPort() {
  const choice = await choosePort({ ownerPorts: [8080], agentRange: [8079, 8081], env: { AGENT_RUN: '1' }, isFree: (p) => p !== 8079 });
  assert.equal(choice.port, 8081);
  const none = await choosePort({ ...base, agentRange: [4000, 4001], env: { AGENT_RUN: '1' }, isFree: () => false });
  assert.equal(none.port, null);
}

import { SessionManager } from '../../src/whatsapp/core/SessionManager.js';

const manager = SessionManager.fromEnvironment();
let state = { generation: 0, paired: false, networkCalls: 0 };
try {
    state = await manager.readState('shadow-restart', 'state');
} catch (error) {
    if (error?.code !== 'ENOENT') throw error;
}
state.generation += 1;
await manager.writeState('shadow-restart', 'state', state);
process.stdout.write(JSON.stringify(state));

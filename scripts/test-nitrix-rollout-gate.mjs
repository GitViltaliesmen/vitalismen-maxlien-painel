import {
    nitrixFastStateAllowsQaDedupeBypass,
    nitrixFastStateAllowsState,
    nitrixFastStateRolloutMode
} from '../src/services/nitrixFastStateService.js';

const assert = (condition, message) => {
    if (!condition) throw new Error(message);
};

const qaEnv = {
    NITRIX_FAST_STATE_ROLLOUT_MODE: 'qa',
    NITRIX_FAST_STATE_TEST_PHONE: '5515998038637'
};
const fullEnv = {
    NITRIX_FAST_STATE_ROLLOUT_MODE: 'full',
    NITRIX_FAST_STATE_TEST_PHONE: '5515998038637'
};
const qaState = { phoneDigits: '5515998038637' };
const customerState = { phoneDigits: '593997680147' };

assert(nitrixFastStateRolloutMode({}) === 'qa', 'sem modo explicito deve permanecer QA');
assert(nitrixFastStateRolloutMode({ NITRIX_FAST_STATE_ROLLOUT_MODE: 'invalid' }) === 'qa', 'modo invalido deve falhar fechado em QA');
assert(nitrixFastStateAllowsState(qaState, qaEnv), 'QA configurado deve passar');
assert(!nitrixFastStateAllowsState(customerState, qaEnv), 'cliente real nao pode passar no modo QA');
assert(nitrixFastStateAllowsQaDedupeBypass(qaState, qaEnv), 'bypass so e permitido ao QA no modo QA');
assert(nitrixFastStateAllowsState(customerState, fullEnv), 'modo full explicito deve permitir cliente real');
assert(!nitrixFastStateAllowsQaDedupeBypass(qaState, fullEnv), 'modo full nao pode carregar bypass do QA');
assert(!nitrixFastStateAllowsState(customerState, { NITRIX_FAST_STATE_ROLLOUT_MODE: 'qa' }), 'QA sem telefone deve falhar fechado');

console.log('Nitrix rollout gate: OK');

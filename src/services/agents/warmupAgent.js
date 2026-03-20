import { handleAgentConversation } from '../conversationEngine.js';
import { getAgentProfile } from '../agentProfiles.js';

export const warmupAgent = {
    handleIncomingMessage: async (msg) => handleAgentConversation(msg, getAgentProfile('warmup'))
};

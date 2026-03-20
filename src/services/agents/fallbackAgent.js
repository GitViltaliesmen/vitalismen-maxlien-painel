import { handleAgentConversation } from '../conversationEngine.js';
import { getAgentProfile } from '../agentProfiles.js';

export const fallbackAgent = {
    handleIncomingMessage: async (msg) => handleAgentConversation(msg, getAgentProfile('fallback'))
};

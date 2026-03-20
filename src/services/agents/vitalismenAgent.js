import { handleAgentConversation } from '../conversationEngine.js';
import { getAgentProfile } from '../agentProfiles.js';

export const vitalismenAgent = {
    handleIncomingMessage: async (msg) => handleAgentConversation(msg, getAgentProfile('vitalismen'))
};

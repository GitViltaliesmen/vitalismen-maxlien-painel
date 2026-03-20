import { handleAgentConversation } from '../conversationEngine.js';
import { getAgentProfile } from '../agentProfiles.js';

export const superfullAgent = {
    handleIncomingMessage: async (msg) => handleAgentConversation(msg, getAgentProfile('superfull_co'))
};

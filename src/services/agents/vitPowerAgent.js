import { handleAgentConversation } from '../conversationEngine.js';
import { getAgentProfile } from '../agentProfiles.js';

export const vitPowerAgent = {
    handleIncomingMessage: async (msg) => handleAgentConversation(
        msg,
        getAgentProfile(msg?.agent || 'vit_power_ec')
    )
};

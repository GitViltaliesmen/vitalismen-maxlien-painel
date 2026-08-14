const messageCache = new Map();
const TTL = 10 * 60 * 1000; // 10 minutos limit for idempotency lock

export const isDuplicate = (messageId) => {
    if (!messageId) return false;
    
    if (messageCache.has(messageId)) {
        return true;
    }
    
    messageCache.set(messageId, Date.now());
    
    // Auto-clean to prevent memory leaks in production
    setTimeout(() => {
        messageCache.delete(messageId);
    }, TTL);
    
    return false;
};

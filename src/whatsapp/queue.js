import PQueue from 'p-queue';

/**
 * We maintain one asynchronous queue per chat user (jid).
 * This prevents the bot from processing 5 messages from the same user at the exact same time,
 * guaranteeing accurate LLM context and perfectly timed audio deliveries.
 */
const queues = new Map(); 

export const enqueueMessage = (jid, task) => {
    if (!queues.has(jid)) {
        // Concurrency 1 guarantees strict FIFO (First In, First Out) for each user
        queues.set(jid, new PQueue({ concurrency: 1 }));
    }
    
    const queue = queues.get(jid);
    return queue.add(task);
};

export const getQueueSize = () => {
    let total = 0;
    for (const q of queues.values()) {
        total += q.size + q.pending;
    }
    return total;
};

const mem = new Map();

export async function getMemory(phoneE164) {
    return mem.get(phoneE164) || { history: [] };
}

export async function pushHistory(phoneE164, userText, botText) {
    const cur = await getMemory(phoneE164);
    const next = {
        history: [...cur.history, { role: "user", content: userText }, { role: "assistant", content: botText }].slice(-30)
    };
    mem.set(phoneE164, next);
    return next;
}

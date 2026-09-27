import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';
import vm from 'node:vm';
import { fileURLToPath } from 'node:url';

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const source = fs.readFileSync(path.join(root, 'src/whatsapp/sendText.js'), 'utf8');
const begin = source.indexOf('const recentHistoryPhoneClauses =');
const end = source.indexOf('const zapiFailoverEnabled =', begin);
assert.ok(begin >= 0 && end > begin, 'history guard source block is present');

const messages = [];
const matchesClause = (message, clause) => Object.entries(clause).every(([field, expected]) => {
    const value = message[field];
    return expected?.$regex ? expected.$regex.test(String(value || '')) : value === expected;
});
const Message = {
    db: { readyState: 1 },
    find(query) {
        const matched = messages.filter((message) =>
            query.$and[0].$or.some((clause) => matchesClause(message, clause))
            && message.isFromMe === true);
        return {
            sort() { return this; },
            limit() { return this; },
            select() { return this; },
            async lean() { return matched; }
        };
    }
};
const normalize = (value) => String(value || '').trim().toLowerCase();
const functions = vm.runInNewContext(
    source.slice(begin, end) + '; ({ recentHistoryPhoneClauses, hasRecentHistoryRepeat })',
    {
        digitsOnly: (value) => String(value || '').replace(/\D/g, ''),
        escapeRegex: (value) => String(value),
        shipmentHistoryRepeatKey: normalize,
        normalizeHistoryText: normalize,
        HISTORY_DEDUPE_WINDOW_MINUTES: 1440,
        Message,
        console
    }
);

const target = '593987654321';
const body = '¿Qué opción desea reservar?';
const check = async (recipientDigits = target) => functions.hasRecentHistoryRepeat({
    targetJid: recipientDigits + '@s.whatsapp.net',
    recipientDigits,
    body
});

test('mesmo cliente e mesma mensagem são bloqueados pelo histórico', async () => {
    messages.splice(0, messages.length, {
        chatId: target + '@s.whatsapp.net', body, isFromMe: true
    });
    assert.equal((await check()).blocked, true);
});

test('mesmo telefone em formato equivalente continua bloqueado', async () => {
    messages.splice(0, messages.length, {
        chatId: '+' + target + '@c.us', body, isFromMe: true
    });
    assert.equal((await check()).blocked, true);
});

test('outro telefone com os mesmos dez dígitos finais não é bloqueado', async () => {
    const other = '57' + target.slice(-10);
    messages.splice(0, messages.length, {
        chatId: other + '@s.whatsapp.net',
        peerPhone: other,
        body,
        isFromMe: true
    });
    assert.equal((await check()).blocked, false);
});

test('cliente sem histórico pode receber a primeira mensagem', async () => {
    messages.splice(0, messages.length);
    assert.equal((await check()).blocked, false);
});

test('mensagem diferente para o mesmo cliente permanece permitida', async () => {
    messages.splice(0, messages.length, {
        chatId: target + '@s.whatsapp.net',
        body: 'Outra mensagem',
        isFromMe: true
    });
    assert.equal((await check()).blocked, false);
});

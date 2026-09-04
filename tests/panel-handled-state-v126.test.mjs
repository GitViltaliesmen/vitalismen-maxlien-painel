import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import {
    panelHandledThroughSeconds,
    panelLastReadMarkerSeconds
} from '../src/services/panelReadStateService.js';

test('marcador persistido de leitura também representa atendimento humano', () => {
    const states = [{
        metadata: {
            panelLastReadAt: '2026-09-04T18:00:00.000Z',
            panelLastReadMessageTimestamp: 1788544800
        }
    }];
    assert.equal(panelHandledThroughSeconds({ states, lastOutboundAt: 1788544700 }), 1788544800);
    assert.equal(panelLastReadMarkerSeconds(states), 1788544800);
});

test('resposta posterior prevalece sobre leitura e novo inbound reabre', () => {
    const handledThrough = panelHandledThroughSeconds({
        states: [{ metadata: { panelLastReadMessageTimestamp: 100 } }],
        lastOutboundAt: 120
    });
    assert.equal(handledThrough, 120);
    assert.equal([90, 100, 120].filter((timestamp) => timestamp > handledThrough).length, 0);
    assert.equal([90, 100, 120, 121].filter((timestamp) => timestamp > handledThrough).length, 1);
});

test('fast e slow chat usam o mesmo handled-through persistente', () => {
    const route = fs.readFileSync('src/routes/whatsapp.js', 'utf8');
    const matches = route.match(/panelHandledThroughSeconds\(/g) || [];
    assert.equal(matches.length, 2);
    assert.match(route, /inboundTimes\.filter\(\(timestamp\) => timestamp > handledThrough\)/);
    assert.match(route, /timestamp: \{ \$gt: handledThrough \}/);
});

test('abrir conversa limpa unread e unanswered localmente após persistência', () => {
    const panel = fs.readFileSync('public/qr.html', 'utf8');
    assert.match(panel, /item\.unreadCount = 0;\s*item\.unansweredCount = 0;/);
    assert.match(panel, /state\.selectedChat\.unreadCount = 0;\s*state\.selectedChat\.unansweredCount = 0;/);
    assert.match(panel, /chat\.unreadCount = 0;\s*chat\.unansweredCount = 0;/);
});

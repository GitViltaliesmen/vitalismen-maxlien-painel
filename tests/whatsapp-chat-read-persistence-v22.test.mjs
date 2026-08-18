import assert from 'node:assert/strict';
import test from 'node:test';
import whatsappRoutes from '../src/routes/whatsapp.js';
import ContactState from '../src/models/ContactState.js';
import Message from '../src/models/Message.js';

const queryResult = (value) => {
    const promise = Promise.resolve(value);
    const query = {
        sort() { return query; },
        limit() { return query; },
        select() { return query; },
        lean() { return query; },
        then(onFulfilled, onRejected) { return promise.then(onFulfilled, onRejected); },
        catch(onRejected) { return promise.catch(onRejected); }
    };
    return query;
};

const replaceMethod = (target, name, replacement, restorers) => {
    const hadOwn = Object.prototype.hasOwnProperty.call(target, name);
    const descriptor = hadOwn ? Object.getOwnPropertyDescriptor(target, name) : null;
    Object.defineProperty(target, name, { configurable: true, writable: true, value: replacement });
    restorers.push(() => {
        if (hadOwn) Object.defineProperty(target, name, descriptor);
        else delete target[name];
    });
};

test('POST /chats/read persiste aliases e o timestamp da ultima entrada visivel', async () => {
    const restorers = [];
    const updates = [];
    const states = [
        {
            _id: 'state-c-us',
            chatId: '593999999999@c.us',
            phoneDigits: '593999999999',
            metadata: { customerDraft: { phone: '+593999999999' } }
        },
        {
            _id: 'state-lid',
            chatId: 'synthetic-alias@lid',
            phoneDigits: 'synthetic-alias',
            metadata: { lastSenderPn: '593999999999' }
        }
    ];
    try {
        replaceMethod(ContactState, 'find', () => queryResult(states), restorers);
        replaceMethod(Message, 'findOne', () => queryResult({ timestamp: 1787049000, peerPhone: '593999999999' }), restorers);
        replaceMethod(ContactState, 'updateMany', async (query, update) => {
            updates.push({ query, update });
            return { matchedCount: 2, modifiedCount: 2 };
        }, restorers);

        const layer = whatsappRoutes.stack.find((item) => item.route?.path === '/chats/read');
        assert.ok(layer, 'rota /chats/read deve existir');
        const handler = layer.route.stack.at(-1).handle;
        const response = {
            statusCode: 200,
            body: null,
            status(code) { this.statusCode = code; return this; },
            json(body) { this.body = body; return this; }
        };
        await handler({
            body: { chatId: 'synthetic-alias@lid', phone: '+593999999999' }
        }, response);

        assert.equal(response.statusCode, 200);
        assert.equal(response.body.success, true);
        assert.equal(response.body.matched, 2);
        assert.equal(response.body.readThroughTimestamp, 1787049000);
        assert.equal(updates.length, 1);
        assert.deepEqual(
            updates[0].query.$or.find((condition) => condition._id)?.['_id']?.$in,
            ['state-c-us', 'state-lid']
        );
        assert.equal(updates[0].update.$set['metadata.panelLastReadMessageTimestamp'], 1787049000);
        assert.ok(updates[0].update.$set['metadata.panelLastReadAt'] instanceof Date);
    } finally {
        restorers.reverse().forEach((restore) => restore());
    }
});

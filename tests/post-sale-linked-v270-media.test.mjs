import test from 'node:test';
import assert from 'node:assert/strict';
import { postSaleV270MediaAllowed } from '../src/services/postSaleLinkedV270Context.js';

const commit = 'a'.repeat(40);
const env = { POST_SALE_V270_RUNTIME_ACTIVE: 'true', POST_SALE_V270_COMMIT: commit };
const context = { postSaleV270: true, postSaleV270Mode: 'run', writeContext: true,
    method: 'POST', path: '/api/shipments/internal/post-sale-v270/cycle' };
const options = { sendMode: 'post_sale_v270', country: 'EC',
    postSaleEvent: { stage: 'DELIVERED_THANK_YOU', dedupeKey: 'one-order-one-stage' } };
const allowed = (changes = {}) => postSaleV270MediaAllowed({ env, context, options,
    linkedCurrent: true, sealedCommit: commit, ...changes });

test('sealed run permits only a canonical post-sale media event', () => {
    assert.equal(allowed(), true);
    assert.equal(allowed({ options: { ...options, postSaleEvent: {
        stage: 'READY_FOR_PICKUP', component: 'AUDIO', dedupeKey: 'one-order-one-stage' } } }), true);
    assert.equal(allowed({ options: { ...options, postSaleEvent: {
        stage: 'READY_FOR_PICKUP', component: 'GUIDE_PDF', dedupeKey: 'one-order-one-stage' } } }), true);
});

test('media remains blocked outside the authenticated V270 operation', () => {
    assert.equal(allowed({ context: { ...context, postSaleV270Mode: 'dry-run' } }), false);
    assert.equal(allowed({ context: { ...context, writeContext: false } }), false);
    assert.equal(allowed({ context: null }), false);
    assert.equal(allowed({ linkedCurrent: false }), false);
    assert.equal(allowed({ sealedCommit: 'b'.repeat(40) }), false);
    assert.equal(allowed({ env: { ...env, POST_SALE_V270_RUNTIME_ACTIVE: 'false' } }), false);
    assert.equal(allowed({ options: { ...options, sendMode: 'automation' } }), false);
    assert.equal(allowed({ options: { ...options, country: 'CO' } }), false);
    assert.equal(allowed({ options: { ...options, postSaleEvent: {
        stage: 'READY_FOR_PICKUP', component: 'TEXT', dedupeKey: 'one-order-one-stage' } } }), false);
    assert.equal(allowed({ options: { ...options, postSaleEvent: {
        stage: 'PRODUCT_USAGE', dedupeKey: '' } } }), false);
});

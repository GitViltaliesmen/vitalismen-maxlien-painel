import assert from 'node:assert/strict';
import fs from 'node:fs';
import test from 'node:test';

import { describeDropiBffFailure } from '../src/services/dropiBffAdapter.js';
import {
    dropiManualReviewMessageV157,
    dropiManualReviewReasonForResultV157
} from '../src/services/dropiSubmitFailurePolicyV157Service.js';

const browserSource = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
const routeSource = fs.readFileSync('src/routes/shipments.js', 'utf8');

test('V157 distingue rejeicao HTTP de falha anterior ao envio', () => {
    assert.equal(dropiManualReviewReasonForResultV157({
        httpStatus: 422,
        lifecycle: { operation: 'create', requestDispatched: true, responseReceived: true, bodyParsed: true }
    }), 'dropi_rejected');
    assert.equal(dropiManualReviewReasonForResultV157({
        httpStatus: 200,
        lifecycle: { operation: 'create', requestDispatched: true, responseReceived: true, bodyParsed: true }
    }), 'dropi_rejected');
    assert.equal(dropiManualReviewReasonForResultV157({
        httpStatus: 502,
        lifecycle: { operation: 'create', requestDispatched: true, responseReceived: true, bodyParsed: false }
    }), 'dropi_submit_unconfirmed');
    assert.equal(dropiManualReviewReasonForResultV157({
        httpStatus: 0,
        lifecycle: { operation: 'create', requestDispatched: true, responseReceived: false }
    }), 'dropi_submit_unconfirmed');
    assert.equal(dropiManualReviewReasonForResultV157({
        httpStatus: 200,
        lifecycle: { operation: 'list', requestDispatched: true, responseReceived: true }
    }), 'dropi_preflight_failed');
    assert.equal(dropiManualReviewReasonForResultV157({}), 'dropi_preflight_failed');
});

test('V157 informa que a checagem anti-duplicidade falhou sem afirmar rejeicao', () => {
    const message = describeDropiBffFailure('DUPLICATE_CHECK_FAILED', 'LIST_RESPONSE_REJECTED');
    assert.match(message, /anti-duplicidade/i);
    assert.match(message, /nenhum pedido foi criado/i);
    assert.doesNotMatch(message, /recusou|rejeitou/i);
    assert.match(dropiManualReviewMessageV157({}), /Nenhum pedido foi criado/i);
    assert.match(dropiManualReviewMessageV157({
        error: 'A Dropi nao confirmou a criacao do pedido.'
    }), /verificacao anterior ao envio/i);
});

test('V157 preserva diagnostico estruturado da consulta e usa a politica nas duas rotas de envio', () => {
    assert.match(browserSource, /code: 'DUPLICATE_CHECK_FAILED'/);
    assert.match(browserSource, /statusReason: error\?\.dropiStatusReason \|\| error\?\.dropiErrorCode \|\| 'ORDER_LOOKUP_NOT_CONFIRMED'/);
    assert.match(browserSource, /requestId: error\?\.dropiRequestId \|\| ''/);
    assert.match(browserSource, /lifecycle: error\?\.dropiLifecycle \|\| null/);
    assert.equal((routeSource.match(/reason: dropiManualReviewReasonForResultV157\(result\)/g) || []).length, 2);
    assert.equal((routeSource.match(/error: dropiManualReviewMessageV157\(result\)/g) || []).length, 2);
});

import assert from 'node:assert/strict';
import { spawnSync } from 'node:child_process';
import vm from 'node:vm';
import test from 'node:test';
import {
    assertFreezeLockEcMetaDynamicV74,
    loadFreezeLockEcMetaDynamicV74Workspace,
    V74_CURRENT_EC_DATASET_ID,
    V74_LEGACY_FREEZE_SHA256,
    V74_LOCKED_SECONDARY_DATASET_ID
} from '../scripts/lib/freeze-lock-ec-meta-dynamic-v74-contract.mjs';
import crypto from 'node:crypto';

const workspace = loadFreezeLockEcMetaDynamicV74Workspace();
const sha256 = (value) => crypto.createHash('sha256').update(value).digest('hex');
const fixture = (mutations = {}) => {
    const sources = new Map(workspace.sources);
    for (const [file, mutate] of Object.entries(mutations)) {
        sources.set(file, mutate(String(sources.get(file) || '')));
    }
    return {
        ...workspace,
        sources,
        readSource: (relativeFile) => sources.get(relativeFile)
    };
};

const expectContractFailure = (mutations, pattern) => assert.throws(
    () => assertFreezeLockEcMetaDynamicV74(fixture(mutations)),
    pattern
);

const inlineScripts = (html) => [...html.matchAll(/<script(?:\s[^>]*)?>([\s\S]*?)<\/script>/gi)]
    .map((match) => match[1]);

const runPixelBootstrap = async ({ available }) => {
    const page = String(workspace.sources.get('public/n/index.html'));
    const pixelScript = inlineScripts(page).find((source) => source.includes('META_PIXEL_READY'));
    assert.ok(pixelScript, 'script inline do Pixel V73 não encontrado');
    const storage = new Map();
    const fbqCalls = [];
    const sandbox = {
        Blob,
        Promise,
        console: { warn() {} },
        document: {
            createElement: () => ({}),
            getElementsByTagName: () => [{ parentNode: { insertBefore() {} } }]
        },
        fetch: async () => ({
            ok: available,
            status: available ? 200 : 503,
            json: async () => available ? {
                ok: true,
                destination: {
                    available: true,
                    tokenConfigured: true,
                    browserServerSynchronized: true,
                    browserPixelId: V74_CURRENT_EC_DATASET_ID,
                    datasetId: V74_CURRENT_EC_DATASET_ID,
                    bindingVersion: 1,
                    binding: 'x'.repeat(43),
                    bindingExpiresAt: new Date(Date.now() + 60_000).toISOString()
                }
            } : { ok: false }
        }),
        sessionStorage: {
            getItem: (key) => storage.get(key) || null,
            setItem: (key, value) => storage.set(key, String(value))
        },
        setTimeout() {},
        window: null
    };
    sandbox.window = sandbox;
    vm.runInNewContext(pixelScript, sandbox, { filename: 'public/n/index.html#meta-pixel-v73' });
    sandbox.window.__mvpMarkLeadOnce('lead-stable-v74');
    sandbox.window.__mvpMarkLeadOnce('lead-stable-v74');
    await sandbox.window.__MAXLIEN_META_PIXEL_READY;
    if (typeof sandbox.fbq === 'function') {
        for (const args of sandbox.fbq.queue || []) fbqCalls.push(args);
    }
    return fbqCalls;
};

test('V73 intacta passa o contrato sucessor V74 e preserva identidades congeladas', () => {
    const result = assertFreezeLockEcMetaDynamicV74(fixture());
    assert.equal(result.ok, true);
    assert.equal(sha256(workspace.legacyFreezeBytes), V74_LEGACY_FREEZE_SHA256);
    assert.equal(workspace.successor.policy.currentEcDatasetId, V74_CURRENT_EC_DATASET_ID);
    assert.equal(workspace.successor.policy.lockedSecondaryDatasetId, V74_LOCKED_SECONDARY_DATASET_ID);
    assert.deepEqual(result.overridesApplied, [
        'meta-pixel-fixed-id-to-dynamic-destination',
        'meta-lead-helper-to-v73-async-once-semantics',
        'site-entry-fixed-id-to-dynamic-destination'
    ]);
});

test('Pixel fixo divergente reintroduzido no HTML falha fechado', () => {
    expectContractFailure({
        'public/n/index.html': (body) => body.replace(
            "fbq('init', pixelId);",
            "fbq('init', pixelId);\n        fbq('init', '9999999999999999');"
        )
    }, /Pixel fixo\/hardcoded reapareceu/);
});

test('Browser e CAPI divergentes no registry falham fechado', () => {
    expectContractFailure({
        'src/services/metaDestinationRegistryService.js': (body) => body.replace(
            'if (browserPixelId !== datasetId)',
            'if (browserPixelId === datasetId)'
        )
    }, /registry Browser\/CAPI equality/);
});

test('endpoint público Meta ausente falha fechado', () => {
    expectContractFailure({
        'src/routes/health.js': (body) => body.replace("router.get('/meta-destination'", "router.get('/meta-destination-disabled'")
    }, /health destination route/);
});

test('token ou segredo serializado pelo endpoint público falha fechado', () => {
    expectContractFailure({
        'src/routes/health.js': (body) => body.replace(
            'destination\n    });',
            'destination,\n        accessToken: process.env.META_ACCESS_TOKEN_EC\n    });'
        )
    }, /endpoint Meta público expõe/);
});

test('segundo caminho Purchase no mesmo fluxo falha fechado', () => {
    expectContractFailure({
        'src/routes/whatsapp.js': (body) => body.replace(
            'const result = await sendPurchaseEventForOrder(order);',
            'const result = await sendPurchaseEventForOrder(order);\n        await sendPurchaseEventForOrder(order);'
        )
    }, /caminho Purchase whatsapp: contagem esperada 1, encontrada 2/);
});

test('remoção da trava Lead once falha fechado', () => {
    expectContractFailure({
        'public/n/index.html': (body) => body.replace(
            'if (sessionStorage.getItem("lead_sent") === "1") return;',
            'if (false) return;'
        )
    }, /VSL Lead once read/);
});

test('segundo disparo Lead no ponto de ação falha fechado', () => {
    expectContractFailure({
        'public/n/index.html': (body) => body.replace(
            'window.__mvpMarkLeadOnce(eventId); } catch(e) {}',
            'window.__mvpMarkLeadOnce(eventId); window.__mvpMarkLeadOnce(eventId); } catch(e) {}'
        )
    }, /VSL pontos autorizados do Lead \(dreno e ação\): contagem esperada 2, encontrada 3/);
});

test('inicialização assíncrona drena chamadas duplicadas como um único Lead com eventID estável', async () => {
    const calls = await runPixelBootstrap({ available: true });
    const leadCalls = calls.filter((args) => args[0] === 'track' && args[1] === 'Lead');
    assert.equal(leadCalls.length, 1);
    assert.equal(leadCalls[0][3].eventID, 'lead-stable-v74');
});

test('configuração temporariamente indisponível limpa a fila e não emite Lead', async () => {
    const calls = await runPixelBootstrap({ available: false });
    assert.equal(calls.filter((args) => args[0] === 'track' && args[1] === 'Lead').length, 0);
});

test('todos os scripts inline da VSL continuam sintaticamente válidos', () => {
    const scripts = inlineScripts(String(workspace.sources.get('public/n/index.html')));
    assert.ok(scripts.length >= 4);
    scripts.forEach((source, index) => assert.doesNotThrow(
        () => new vm.Script(source, { filename: `public/n/index.html#inline-${index + 1}` })
    ));
});

test('harness local reproduz o freeze_lock_pre da V73 pelo entrypoint histórico sem bypass', () => {
    const run = spawnSync(process.execPath, ['scripts/guard-freeze-lock-ec.mjs'], {
        cwd: process.cwd(),
        encoding: 'utf8'
    });
    assert.equal(run.status, 0, `${run.stdout}\n${run.stderr}`);
    assert.match(run.stdout, /19 regra\(s\) congelada\(s\) preservada\(s\)/);
    assert.match(run.stdout, /3 checks sucedidos explicitamente pela V74/);
    assert.match(run.stdout, /V73_DYNAMIC_META_CONTRACT=PASS/);
});

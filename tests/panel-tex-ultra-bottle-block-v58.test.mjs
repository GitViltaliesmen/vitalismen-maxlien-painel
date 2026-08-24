import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import test from 'node:test';

const root = process.cwd();
const panel = fs.readFileSync(path.join(root, 'public/qr.html'), 'utf8');
const officialBottlePath = '/media/sales/ec/tex_ultra.png';
const officialBottleFile = path.join(root, 'public/media/sales/ec/tex_ultra.png');

const sourceBetween = (start, end) => {
    const startIndex = panel.indexOf(start);
    const endIndex = panel.indexOf(end, startIndex + start.length);
    assert.ok(startIndex >= 0, `inicio nao encontrado: ${start}`);
    assert.ok(endIndex > startIndex, `fim nao encontrado: ${end}`);
    return panel.slice(startIndex, endIndex);
};

test('V58 M01 e B01 usam o frasco oficial existente do Tex Ultra', () => {
    assert.equal(fs.existsSync(officialBottleFile), true);
    assert.equal(fs.statSync(officialBottleFile).size, 95744);

    const mediaLibrary = sourceBetween('const footerMediaFiles = () => {', 'const randomBetween =');
    assert.match(mediaLibrary, /isTexUltra[\s\S]*?value: '\/media\/sales\/ec\/tex_ultra\.png'/);

    const blocks = sourceBetween('const footerFunnelBlocks = () => {', 'const sortedFooterAudioTemplates =');
    const texBlock = blocks.slice(
        blocks.indexOf("value: 'tex_ultra_inicio_completo'"),
        blocks.indexOf("value: 'vit_power_inicio_completo'")
    );
    assert.match(texBlock, /label: 'Frasco Tex Ultra', value: '\/media\/sales\/ec\/tex_ultra\.png'/);
    assert.doesNotMatch(panel, /tex_ultra_bottle\.png/);
});

test('V58 B01 preserva sequencia e tabela promocional oficial depois do frasco', () => {
    const blocks = sourceBetween('const footerFunnelBlocks = () => {', 'const sortedFooterAudioTemplates =');
    const texBlock = blocks.slice(
        blocks.indexOf("value: 'tex_ultra_inicio_completo'"),
        blocks.indexOf("value: 'vit_power_inicio_completo'")
    );
    const expectedOrder = [
        "value: 'tex_ultra_personalized_entry'",
        'value: TEX_ULTRA_UNIVERSAL_ENTRY_AUDIO_EC',
        "value: '/media/sales/shared/social_01.jpeg'",
        `value: '${officialBottlePath}'`,
        "value: 'tex_ultra_promotion_1'"
    ];
    let cursor = -1;
    for (const token of expectedOrder) {
        const next = texBlock.indexOf(token);
        assert.ok(next > cursor, `etapa fora de ordem: ${token}`);
        cursor = next;
    }

    const drafts = sourceBetween('const buildDraftTemplate = (kind) => {', 'const fillDraftTemplate =');
    assert.match(drafts, /tex_ultra_promotion_1:[\s\S]*?1 frasco por solo \$35,99/);
    assert.match(drafts, /tex_ultra_promotion_1:[\s\S]*?2 frascos por \$70,00/);
    assert.match(drafts, /tex_ultra_promotion_1:[\s\S]*?3 frascos por \$80,99/);
    assert.match(drafts, /tex_ultra_promotion_1:[\s\S]*?6 frascos \(tratamiento completo\) por \$147,99/);
});

test('V58 etapas do bloco reconciliam a bolha local com a confirmacao persistida', () => {
    const sender = sourceBetween('async function sendFunnelBlock', 'const buildAvisos =');
    assert.match(sender, /clientGeneratedId:\s*activePendingMessage\?\.clientGeneratedId/);
    assert.match(sender, /sessionId,/);
    assert.match(sender, /country:\s*currentTemplateCountry\(\)/);
    assert.match(sender, /confirmPendingLocalMessage\(activePendingMessage\?\._id, result\)/);
    assert.match(sender, /markPendingLocalMessageStatus\([\s\S]*?activePendingMessage\?\._id,[\s\S]*?'unconfirmed'/);
    assert.doesNotMatch(sender, /removePendingLocalMessage\(activePendingMessage\?\._id\)/);
});

test('V58 nenhuma referencia ativa de midia do painel aponta para arquivo ausente', () => {
    const aliasSource = sourceBetween('const legacyFunnelMediaAliases = new Map([', 'const normalizeLegacyFunnelMediaValue =');
    const aliasPaths = new Set(
        [...aliasSource.matchAll(/\['(\/media\/[^']+)',\s*'(\/media\/[^']+)'\]/g)]
            .flatMap((match) => [match[1], match[2]])
    );
    const references = [...panel.matchAll(/['"](\/media\/[A-Za-z0-9._/-]+\.(?:png|jpe?g|webp|gif|ogg|opus|mp3|wav|m4a|aac|webm|mp4|mov))['"]/gi)]
        .map((match) => match[1]);
    const missing = [...new Set(references)].filter((mediaPath) => (
        !aliasPaths.has(mediaPath)
        && !fs.existsSync(path.join(root, 'public', mediaPath.slice(1)))
    ));
    assert.deepEqual(missing, []);
});

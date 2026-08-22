import assert from 'node:assert/strict';
import fs from 'node:fs';

await import('../src/services/panelZapiAuthStatusFreezeRuntimeGuardV37.js');

const read = (relativePath) => fs.readFileSync(relativePath, 'utf8');
const packageJson = JSON.parse(read('package.json'));
const index = read('src/index.js');
const engine = read('src/services/conversationEngine.js');
const service = read('src/services/ecProductIngredientsService.js');
const successor = 'node src/services/panelZapiAuthStatusFreezeRuntimeGuardV37.js';

for (const scriptName of [
    'senior:check',
    'guard:whatsapp-chats-readonly',
    'guard:logistics-clean-chat-v29',
    'guard:deploy-integration-v29-1',
    'guard:operational-mode-zapi-health',
    'guard:media-durability-v30',
    'guard:tex-ultra-how-to-use-v31',
    'guard:official-whatsapp-phone-v32',
    'guard:panel-image-csp-v33',
    'guard:protocolo-g-tex-ultra-v34',
    'guard:ec-product-ingredients-v35',
    'guard:ec-all-products-ingredients-v36',
    'guard:panel-zapi-auth-status-v37',
    'guard:ec-nitrix',
    'guard:ec-identity',
    'guard:tex-ultra-approved',
    'guard:ec-product-funnel-isolation',
    'deploy:ec-safe',
    'deploy:vps'
]) {
    assert.equal(String(packageJson.scripts[scriptName] || '').startsWith(successor), true, `${scriptName} não preserva V35 sob V37`);
}

assert.match(index, /import '\.\/services\/panelZapiAuthStatusFreezeRuntimeGuardV37\.js';/);
assert.doesNotMatch(index, /^import '.+protocoloGTexUltraFreezeRuntimeGuardV34\.js';/m);
assert.match(engine, /import \{ maybeHandleEcuadorProductIngredients \} from '\.\/ecProductIngredientsService\.js';/);
assert.match(engine, /activeProductKey: agentProfile\?\.key \|\| ''/);
assert.ok(
    engine.indexOf('await maybeHandleEcuadorProductIngredients({')
        < engine.indexOf('if (agentProfile?.key === NITRIX_AGENT_KEY)'),
    'FAQ deve rodar antes da barreira Nitrix'
);
assert.match(service, /tex_ultra_ec:[\s\S]+maca peruana[\s\S]+Tribulus terrestris[\s\S]+catuaba[\s\S]+marapuama[\s\S]+zinc[\s\S]+magnesio/);
assert.match(service, /nitrix_ec:[\s\S]+fenogreco \(fenugreek\)[\s\S]+ginseng Panax \(ginseng rojo coreano\)[\s\S]+ashwagandha[\s\S]+Ginkgo biloba[\s\S]+L-arginina/);
assert.match(service, /vit_power_ec:[\s\S]+borojó[\s\S]+chontaduro[\s\S]+noni[\s\S]+guaraná[\s\S]+vitaminas/);
assert.match(service, /memoryField: 'productIngredientsFaq'/);
assert.match(service, /const lockPath = `\$\{memoryPath\}\.lockedUntil`/);
assert.match(service, /FAQ_COOLDOWN_MS = 30 \* 60 \* 1000/);
assert.match(service, /allowExistingDropiOrder: true/);
assert.match(service, /antiSpamScope = reply\.scope === 'all_products' \? 'all_products' : reply\.productKey/);
assert.match(service, /explicit\[0\] !== active/);
assert.match(service, /hasSensitiveHealthContext\(text\)/);
assert.doesNotMatch(service, /cura|sin contraindicaciones|100% seguro/i);
assert.match(packageJson.scripts['senior:check'], /ec-product-ingredients-v35\.test\.mjs/);
assert.match(packageJson.scripts['deploy:vps'], /assert-ec-product-ingredients-activation-approved-v35\.mjs/);

console.log('EC_PRODUCT_INGREDIENTS_V35_GUARD=OK');

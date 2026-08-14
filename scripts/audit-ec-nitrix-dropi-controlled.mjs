import fs from 'node:fs';
import path from 'node:path';

const root = process.cwd();
const read = (file) => fs.readFileSync(path.join(root, file), 'utf8');

const checks = [];
const assertIncludes = (file, needle, label) => {
    const ok = read(file).includes(needle);
    checks.push({ ok, label, file });
    if (!ok) throw new Error(`${label}: ${file} nao contem ${needle}`);
};
const assertNotIncludes = (file, needle, label) => {
    const ok = !read(file).includes(needle);
    checks.push({ ok, label, file });
    if (!ok) throw new Error(`${label}: ${file} ainda contem ${needle}`);
};

assertIncludes('src/services/ecuadorProductService.js', "key: 'nitrix_ec'", 'Produto Nitrix EC registrado');
assertIncludes('src/services/ecuadorProductService.js', 'NITRIC OXIDE', 'Aliases Nitrix/Oxido Nitrico registrados');
assertIncludes('src/services/droppiEcuadorService.js', 'resolveEcuadorProductInfo(order)', 'Payload Dropi resolve produto pelo pedido');
assertIncludes('src/services/droppiEcuadorService.js', '...productMetadata', 'Payload Dropi envia metadados do produto');
assertNotIncludes('src/services/droppiEcuadorService.js', "productName: 'Vit Power',", 'Payload Dropi nao fixa Vit Power');
assertIncludes('src/services/droppiEcuadorService.js', 'preserveManualReview', 'Sync Dropi preserva revisao manual Nitrix');
assertIncludes('src/services/droppiEcuadorService.js', "normalizedStatus === 'NOVEDAD' ? true : undefined", 'Sync Dropi nao solta manualOnly quando status nao e Novedad');
assertIncludes('src/services/droppiEcuadorBrowserService.js', 'DROPPI_EC_NITRIX_PRODUCT_ALIASES', 'Browser Dropi aceita aliases Nitrix');
assertIncludes('src/services/droppiEcuadorBrowserService.js', 'target.aliases', 'Selecao Dropi usa alvo do produto');
assertIncludes('src/services/droppiEcuadorBrowserService.js', 'directButtonAllowed', 'Busca Dropi nao clica direto em produto errado');
assertIncludes('src/services/droppiEcuadorBrowserService.js', 'productMatchesTarget(lastBodyText, target)', 'Pagina direta Dropi exige texto do produto alvo');
assertIncludes('src/services/droppiEcuadorBrowserService.js', 'dropiRowProductMatchesShipment', 'Sync ativo Dropi nao contamina shipment de outro produto');
assertIncludes('src/services/droppiEcuadorBrowserService.js', 'inspectDroppiEcuadorProductTarget', 'Inspecao segura de produto Dropi existe');
assertIncludes('scripts/inspect-dropi-ec-product-target.mjs', 'inspectDroppiEcuadorProductTarget', 'Script de inspecao segura Dropi existe');
assertIncludes('src/services/droppiEcuadorBrowserService.js', 'nitrix_order_product_mismatch', 'Envio bloqueia pedido Vit com mensagem Nitrix');
assertIncludes('src/services/droppiEcuadorBrowserService.js', 'DROPPI_EC_NITRIX_PRODUCT_ENABLED', 'Envio Nitrix exige habilitacao explicita');
assertIncludes('src/routes/whatsapp.js', 'inferProductInfoForDraft', 'Ficha WhatsApp infere produto por historico');
assertIncludes('src/routes/whatsapp.js', 'recentNitrixMessage', 'Ficha usa mensagem recente Nitrix');
assertIncludes('src/routes/whatsapp.js', 'ecuadorPackageLabel', 'Ficha usa label por produto');

console.log(`[audit-ec-nitrix-dropi-controlled] OK - ${checks.length} verificacoes passaram.`);

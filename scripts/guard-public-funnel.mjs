import { execFileSync, spawnSync } from 'child_process';
import fs from 'fs';

const root = process.cwd();
const failures = [];
const warnings = [];
const notes = [];

const sshKey = process.env.VITALISMEN_DEPLOY_KEY || `${process.env.HOME || ''}/.ssh/vps_auditoria_codex`;
const sshTarget = process.env.VITALISMEN_GUARD_SSH_TARGET || process.env.VITALISMEN_DEPLOY_HOST || 'root@maxlien.shop';
const sshAlias = process.env.VITALISMEN_GUARD_SSH_ALIAS || '';
const publicBase = process.env.VITALISMEN_GUARD_PUBLIC_BASE || 'https://maxlien.shop';
const ecBase = process.env.VITALISMEN_GUARD_EC_BASE || 'https://ec.maxlien.shop';

const ok = (message) => notes.push(`OK  ${message}`);
const warn = (message) => warnings.push(`WARN ${message}`);
const fail = (message) => failures.push(`FAIL ${message}`);

const run = (cmd, args, options = {}) => spawnSync(cmd, args, {
    cwd: root,
    encoding: 'utf8',
    timeout: options.timeout || 20000,
    input: options.input || undefined
});

const sshArgs = (remoteCommand) => {
    const args = ['-i', sshKey, '-o', 'StrictHostKeyChecking=accept-new'];
    if (sshAlias) args.push('-o', `HostKeyAlias=${sshAlias}`);
    args.push(sshTarget, remoteCommand);
    return args;
};

const ssh = (remoteCommand, options = {}) => {
    if (!fs.existsSync(sshKey)) {
        return { status: 127, stdout: '', stderr: `missing ssh key: ${sshKey}` };
    }
    return run('ssh', sshArgs(remoteCommand), { timeout: options.timeout || 30000 });
};

const fetchText = async (url, options = {}) => {
    const controller = new AbortController();
    const timer = setTimeout(() => controller.abort(), options.timeout || 8000);
    try {
        const response = await fetch(url, {
            method: options.method || 'GET',
            headers: options.headers || undefined,
            body: options.body || undefined,
            signal: controller.signal,
            redirect: options.redirect || 'follow'
        });
        const text = await response.text();
        return { ok: response.ok, status: response.status, text, headers: response.headers };
    } finally {
        clearTimeout(timer);
    }
};

const parseJson = (text) => {
    try {
        return JSON.parse(text);
    } catch {
        return null;
    }
};

const auditLocalCode = () => {
    const orderModel = fs.readFileSync('src/models/Order.js', 'utf8');
    const index = fs.readFileSync('src/index.js', 'utf8');
    const leadRouteExists = fs.existsSync('src/routes/leads.js');
    const engine = fs.readFileSync('src/services/conversationEngine.js', 'utf8');
    const adminSync = fs.readFileSync('src/services/adminPanelStatusService.js', 'utf8');
    const duplicateGuard = fs.readFileSync('src/services/orderDuplicateGuardService.js', 'utf8');
    const ordersRoute = fs.readFileSync('src/routes/orders.js', 'utf8');
    const leadsRoute = fs.readFileSync('src/routes/leads.js', 'utf8');
    const shipmentsRoute = fs.readFileSync('src/routes/shipments.js', 'utf8');
    const adminImport = fs.readFileSync('src/services/adminPanelImportService.js', 'utf8');
    const dropiBrowser = fs.readFileSync('src/services/droppiEcuadorBrowserService.js', 'utf8');
    const dropiService = fs.readFileSync('src/services/droppiEcuadorService.js', 'utf8');
    const shipmentDispatcher = fs.readFileSync('src/services/shipmentStatusDispatcherService.js', 'utf8');

    if (orderModel.includes('reference: { type: String, default: \'\'')) ok('Order.customer.reference existe e e opcional.');
    else fail('Order.customer.reference opcional nao encontrado.');

    if (
        orderModel.includes("orderSchema.post('save'")
        && orderModel.includes('syncOrderToOnlineAdminPanel')
        && adminSync.includes('export const syncOrderToOnlineAdminPanel')
        && adminSync.includes('Pedido automacao:')
        && adminSync.includes('lead_history')
    ) {
        ok('Pedidos salvos no Atendimento/Formulario sincronizam com Painel Unificado como banco operacional.');
    } else {
        fail('Order/adminPanelStatusService perdeu sincronizacao automatica com Painel Unificado.');
    }

    if (
        dropiBrowser.includes('syncOrderToOnlineAdminPanel')
        && dropiBrowser.includes("action: 'dropi_order_submitted'")
        && dropiService.includes("action: 'dropi_status_sync'")
        && shipmentDispatcher.includes('syncShipmentOrderToAdminPanel')
        && shipmentDispatcher.includes("if (action === 'delivered_bonus') return 'delivered'")
    ) {
        ok('Dropi/status de entrega sincroniza status para o Painel Unificado.');
    } else {
        fail('Dropi deixou de comunicar pedido enviado/entregue/devolvido ao Painel Unificado.');
    }

    if (
        duplicateGuard.includes('active_duplicate_order')
        && duplicateGuard.includes('repurchase_manual_authorization_required')
        && ordersRoute.includes('assertNoActiveDuplicateOrder')
        && leadsRoute.includes('duplicateBlocked')
        && shipmentsRoute.includes('duplicateGuardResponse')
        && shipmentsRoute.includes('Recompra liberada manualmente')
        && shipmentsRoute.includes('Pedido precisa ser autorizado antes de marcar envio manual')
        && adminImport.includes('skippedDuplicates')
    ) {
        ok('Regra anti-duplicacao bloqueia pedido ativo e libera recompra so com autorizacao manual.');
    } else {
        fail('Regra anti-duplicacao/recompra manual foi removida ou ficou incompleta.');
    }

    if (leadRouteExists && index.includes("app.use('/api/lead', leadsRoutes)")) ok('API nova registra /api/lead no dashboard.');
    else fail('/api/lead nao esta registrado na API nova.');

    if (
        engine.includes('const requiresHomeReference')
        && engine.includes("parsedOrder.deliveryMode === 'home'")
        && engine.includes("missing.push('reference')")
        && engine.includes('deliveryMode: \'agency\'')
    ) {
        ok('WhatsApp exige ponto de referencia somente para entrega em domicilio/casa.');
    } else {
        fail('conversationEngine nao deixa claro que referencia e obrigatoria so para domicilio/casa.');
    }

    if (engine.includes('punto de referencia para la entrega a domicilio')) ok('WhatsApp pede referencia com contexto de entrega a domicilio.');
    else fail('conversationEngine nao possui prompt correto para referencia em domicilio.');

    if (engine.includes('normalizeServientregaVariants') && engine.includes('se\\s+ventrega')) {
        ok('WhatsApp normaliza variacao "Se ventrega" como Servientrega.');
    } else {
        fail('conversationEngine nao protege a variacao "Se ventrega" de Servientrega.');
    }

    if (/sucua\|sucúa/.test(engine) && engine.includes('resolveServientregaEcuadorAgency')) {
        ok('WhatsApp reconhece Sucua/Sucúa para busca de agencia Servientrega.');
    } else {
        fail('conversationEngine nao esta vigiando Sucua/Sucúa no fluxo de agencia.');
    }

    const panel = fs.readFileSync('public/qr.html', 'utf8');
    if (
        panel.includes('id="leadDashboardFrame"')
        && panel.includes('id="leadDashboardOpenLink"')
        && panel.includes("'/leads-window.html?country=EC'")
        && !panel.includes('src="https://maxlien.shop/admin/dashboard?country=EC"')
        && !panel.includes('href="https://maxlien.shop/admin/dashboard?country=EC"')
    ) {
        ok('Modulo Leads Clientes mantem Painel Unificado completo em iframe do mesmo dominio.');
    } else {
        fail('Modulo Leads Clientes perdeu o Painel Unificado completo ou voltou para URL fixa maxlien.shop.');
    }

    if (
        panel.includes('Enviar pedido Dropi')
        && panel.includes('persistSelectedCustomerData({ silent: true })')
        && panel.includes('Todo envio para Dropi exige autorizacao manual antes')
        && panel.includes('Agora clique novamente para enviar para Dropi')
    ) {
        ok('Atendimento salva ficha e exige autorizacao manual antes de enviar para Dropi.');
    } else {
        fail('Atendimento perdeu a exigencia de autorizacao manual antes do envio Dropi.');
    }

    if (
        panel.includes('id="confirmedDropdownPanel"')
        && panel.includes('Pedidos confirmados para Dropi')
        && panel.includes('renderConfirmedDropdown(allLoadedOrders)')
        && panel.includes("el('confirmedDropdownPanel').addEventListener('click'")
    ) {
        ok('Modulo Pedidos Confirmados possui lista suspensa na visao geral com acoes de Dropi.');
    } else {
        fail('Modulo Pedidos Confirmados perdeu a lista suspensa de confirmados na visao geral.');
    }
};

const auditRemoteConversationEngine = () => {
    const result = ssh([
        'cd /opt/vitalismen-automacao/current',
        'grep -q "normalizeServientregaVariants" src/services/conversationEngine.js',
        'grep -Fq "se\\\\s+ventrega" src/services/conversationEngine.js',
        'grep -Eq "sucua|sucúa" src/services/conversationEngine.js',
        'grep -q "const requiresHomeReference" src/services/conversationEngine.js',
        'grep -q "punto de referencia para la entrega a domicilio" src/services/conversationEngine.js',
        'grep -q "syncOrderToOnlineAdminPanel" src/models/Order.js',
        'grep -q "active_duplicate_order" src/services/orderDuplicateGuardService.js',
        'grep -q "repurchase_manual_authorization_required" src/services/orderDuplicateGuardService.js',
        'grep -q "assertNoActiveDuplicateOrder" src/routes/orders.js',
        'grep -q "duplicateBlocked" src/routes/leads.js',
        'grep -q "duplicateGuardResponse" src/routes/shipments.js',
        'grep -q "skippedDuplicates" src/services/adminPanelImportService.js',
        'grep -q "export const syncOrderToOnlineAdminPanel" src/services/adminPanelStatusService.js',
        'grep -q "Pedido automacao:" src/services/adminPanelStatusService.js',
        'grep -q "dropi_order_submitted" src/services/droppiEcuadorBrowserService.js',
        'grep -q "dropi_status_sync" src/services/droppiEcuadorService.js',
        'grep -q "syncShipmentOrderToAdminPanel" src/services/shipmentStatusDispatcherService.js',
        'grep -q "Enviar pedido Dropi" public/qr.html',
        'grep -q "persistSelectedCustomerData({ silent: true })" public/qr.html',
        'grep -q "Todo envio para Dropi exige autorizacao manual antes" public/qr.html',
        'grep -q "Agora clique novamente para enviar para Dropi" public/qr.html',
        'grep -q "Pedido precisa ser autorizado antes de marcar envio manual" src/routes/shipments.js',
        'grep -q "id=\\"confirmedDropdownPanel\\"" public/qr.html',
        'grep -q "Pedidos confirmados para Dropi" public/qr.html',
        'grep -q "id=\\"leadDashboardFrame\\"" public/qr.html',
        'grep -q "id=\\"leadDashboardOpenLink\\"" public/qr.html',
        'grep -q "\\/admin\\/dashboard?country=EC" public/qr.html',
        '! grep -q "src=\\"https://maxlien.shop/admin/dashboard?country=EC\\"" public/qr.html',
        '! grep -q "href=\\"https://maxlien.shop/admin/dashboard?country=EC\\"" public/qr.html'
    ].join(' && '));

    if (result.status === 0) {
        ok('VPS possui correcoes de Servientrega/Sucua, referencia domicilio, Painel Unificado completo e sincronizacao central.');
    } else {
        fail(`VPS nao possui todas as correcoes amarradas:\n${result.stdout}${result.stderr}`);
    }
};

const auditPublicHtml = async () => {
    const local = ssh('grep -n "name=\\"province\\"\\|name=\\"city\\"\\|name=\\"address\\"\\|Punto de referencia\\|waFallbackTimer\\|Backend obrigatório" /var/www/ec.maxlien.shop/m/index.html || true');
    if (local.status === 0 && local.stdout) {
        const body = local.stdout;
        if (body.includes('Punto de referencia (opcional)')) ok('VPS /m/ marca ponto de referencia como opcional.');
        else fail('VPS /m/ nao mostra ponto de referencia opcional.');
        if (!/name="province"[^>\n]*required/.test(body) && !/name="city"[^>\n]*required/.test(body) && !/name="address"[^>\n]*required/.test(body)) {
            ok('VPS /m/ deixa provincia, cidade e endereco opcionais.');
        } else {
            fail('VPS /m/ voltou a exigir provincia, cidade ou endereco.');
        }
        if (!body.includes('waFallbackTimer')) ok('VPS /m/ nao tem fallback que abre WhatsApp sem salvar lead.');
        else fail('VPS /m/ ainda contem waFallbackTimer.');
        if (body.includes('Backend obrigatório')) ok('VPS /m/ exige salvar lead antes do WhatsApp.');
        else fail('VPS /m/ nao contem trava de backend obrigatorio.');
        return;
    }

    warn(`nao consegui ler HTML direto no VPS: ${local.stderr || local.stdout || 'sem saida'}`);
    const publicPage = await fetchText(`${ecBase}/m/?showForm=1`);
    if (!publicPage.ok) {
        fail(`pagina publica /m/ nao respondeu OK: ${publicPage.status}`);
        return;
    }
    if (publicPage.text.includes('Punto de referencia (opcional)')) ok('pagina publica /m/ marca ponto de referencia como opcional.');
    else fail('pagina publica /m/ nao mostra ponto de referencia opcional.');
    if (!/name="province"[^>]*required/.test(publicPage.text) && !/name="city"[^>]*required/.test(publicPage.text) && !/name="address"[^>]*required/.test(publicPage.text)) {
        ok('pagina publica /m/ deixa provincia, cidade e endereco opcionais.');
    } else {
        fail('pagina publica /m/ voltou a exigir provincia, cidade ou endereco.');
    }
    if (!publicPage.text.includes('waFallbackTimer')) ok('pagina publica /m/ nao tem waFallbackTimer.');
    else fail('pagina publica /m/ ainda contem waFallbackTimer.');
};

const auditNginx = () => {
    const result = ssh([
        'grep -R -n "127.0.0.1:.*api/lead" /etc/nginx/sites-enabled/maxlien.shop.conf /etc/nginx/sites-enabled/ec.maxlien.shop.clean.conf',
        'nginx -t'
    ].join(' && '));

    if (result.status !== 0) {
        fail(`nginx/proxy /api/lead nao conferiu:\n${result.stdout}${result.stderr}`);
        return;
    }

    const output = `${result.stdout}\n${result.stderr}`;
    if (output.includes('127.0.0.1:5055/api/lead')) fail('/api/lead ainda aponta para 5055 em alguma config nginx.');
    else ok('/api/lead nao aponta mais para 5055.');

    const expected = (output.match(/127\.0\.0\.1:3001\/api\/lead/g) || []).length;
    if (expected >= 4) ok('/api/lead aponta para 3001 nos vhosts maxlien e ec.');
    else fail(`/api/lead deveria apontar para 3001 em 4 blocos; encontrados=${expected}.`);

    if (output.includes('syntax is ok') && output.includes('test is successful')) ok('nginx -t OK.');
    else fail('nginx -t nao confirmou sucesso.');
};

const auditPm2 = () => {
    const result = ssh('pm2 show vitalismen-automation | grep -E "status|script path|exec cwd"');
    if (result.status !== 0) {
        fail(`PM2 vitalismen-automation nao conferiu:\n${result.stdout}${result.stderr}`);
        return;
    }
    const output = result.stdout;
    if (output.includes('online')) ok('PM2 vitalismen-automation online.');
    else fail('PM2 vitalismen-automation nao esta online.');

    if (output.includes('/opt/vitalismen-automacao/releases/')) ok('PM2 aponta para release oficial em /opt/vitalismen-automacao.');
    else fail('PM2 nao aponta para release oficial da automacao.');
};

const auditLeadsDashboardAccess = async () => {
    const marker = ssh([
        'grep -q "senhas dos paineis serao definidas futuramente" /opt/maxlien-mvp/app.py',
        'grep -q "MAXLIEN_ADMIN_PASSWORD_DISABLED" /opt/maxlien-mvp/app.py'
    ].join(' && '));
    if (marker.status === 0) {
        ok('VPS marca senha dos paineis como futura e libera o Painel Unificado temporariamente.');
    } else {
        fail(`VPS nao possui trava documentada para deixar Leads Clientes sem senha temporariamente:\n${marker.stdout}${marker.stderr}`);
    }

    const dashboard = await fetchText(`${ecBase}/admin/dashboard?country=EC`, { redirect: 'manual' });
    if (
        dashboard.status === 200
        && dashboard.text.includes('Painel Unificado')
        && dashboard.text.includes('Leads Recentes')
        && dashboard.text.includes('/admin/edit/')
        && !dashboard.headers.get('location')
    ) {
        ok('Leads Clientes abre Painel Unificado online sem redirecionar para login.');
    } else {
        fail(`Leads Clientes nao abriu Painel Unificado direto: status=${dashboard.status} location=${dashboard.headers.get('location') || ''}`);
    }

    const api = await fetchText(`${ecBase}/admin/api/leads?country=EC&limit=1`, { redirect: 'manual' });
    const apiJson = parseJson(api.text);
    if (api.status === 200 && apiJson?.ok === true && Array.isArray(apiJson.leads)) {
        ok('API do Painel Unificado responde sem senha para manter lista/edicao funcionando.');
    } else {
        fail(`/admin/api/leads voltou a exigir senha ou falhou: status=${api.status} body=${api.text.slice(0, 200)}`);
    }
};

const auditLeadEndpoint = async () => {
    const invalidPayload = {
        country: 'EC',
        name: '',
        phone: '',
        province: 'Pichincha',
        city: 'Quito',
        address: '',
        reference: '',
        product_qty: 1,
        product_value: 39.99
    };

    const invalid = await fetchText(`${publicBase}/api/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(invalidPayload)
    });
    const invalidJson = parseJson(invalid.text);
    if (invalid.status === 400 && invalidJson?.error === 'Incomplete lead data') {
        ok('/api/lead publico responde pela API nova e rejeita lead sem nome/telefone.');
    } else {
        fail(`/api/lead publico nao rejeitou falta de nome/telefone como esperado: status=${invalid.status} body=${invalid.text.slice(0, 200)}`);
    }

    const testPhone = `099${String(Date.now()).slice(-7)}`;
    const validPayload = {
        country: 'EC',
        name: 'Guard Codex Teste',
        phone: testPhone,
        province: '',
        city: '',
        address: '',
        reference: '',
        product_qty: 3,
        product_value: 95.99,
        utm_source: 'guard-public-funnel',
        event_source_url: `${ecBase}/m/`
    };

    const valid = await fetchText(`${publicBase}/api/lead`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify(validPayload)
    });
    const validJson = parseJson(valid.text);
    if (valid.status >= 200 && valid.status < 300 && validJson?.success && validJson?.orderId) {
        ok('/api/lead publico cria pedido somente com nome e telefone.');
        const cleanup = ssh(`cd /opt/vitalismen-automacao/current && node --input-type=module -e 'import "dotenv/config"; import connectDB from "./src/config/db.js"; import Order from "./src/models/Order.js"; await connectDB(); const r = await Order.deleteOne({ orderId: ${JSON.stringify(validJson.orderId)} }); console.log(JSON.stringify({ deleted: r.deletedCount })); process.exit(0);'`);
        if (cleanup.status === 0 && cleanup.stdout.includes('"deleted":1')) ok(`pedido teste ${validJson.orderId} removido.`);
        else warn(`nao consegui remover pedido teste ${validJson.orderId}: ${cleanup.stdout}${cleanup.stderr}`);
        const cleanupAdmin = ssh(`python3 - <<'PY'\nimport sqlite3, json\norder_id = ${JSON.stringify(validJson.orderId)}\ncon = sqlite3.connect('/opt/maxlien-mvp/leads_ec.sqlite3')\ncur = con.cursor()\nids = [row[0] for row in cur.execute(\"SELECT id FROM leads WHERE event_id=? OR notes LIKE ?\", (order_id, '%' + order_id + '%')).fetchall()]\nif ids:\n    cur.executemany(\"DELETE FROM lead_history WHERE lead_id=?\", [(lead_id,) for lead_id in ids])\n    cur.executemany(\"DELETE FROM leads WHERE id=?\", [(lead_id,) for lead_id in ids])\ncon.commit()\nprint(json.dumps({\"deleted\": len(ids)}))\ncon.close()\nPY`);
        if (cleanupAdmin.status === 0) ok(`lead teste ${validJson.orderId} removido do Painel Unificado.`);
        else warn(`nao consegui remover lead teste ${validJson.orderId} do Painel Unificado: ${cleanupAdmin.stdout}${cleanupAdmin.stderr}`);
    } else {
        fail(`/api/lead publico nao criou pedido somente com nome e telefone: status=${valid.status} body=${valid.text.slice(0, 300)}`);
    }
};

auditLocalCode();
auditRemoteConversationEngine();
await auditPublicHtml();
auditNginx();
auditPm2();
await auditLeadsDashboardAccess();
await auditLeadEndpoint();

console.log('\n=== Guard public funnel ===');
for (const line of notes) console.log(line);
for (const line of warnings) console.warn(line);
for (const line of failures) console.error(line);

if (failures.length) {
    console.error(`\nResultado: BLOQUEADO (${failures.length} falha(s), ${warnings.length} aviso(s)).`);
    process.exit(1);
}

console.log(`\nResultado: OK (${warnings.length} aviso(s)).`);

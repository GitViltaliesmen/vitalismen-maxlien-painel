# Congelado VSL / Meta EC e status do painel - 2026-07-09

## Camada congelada antes do ajuste

- VSL publica do Equador: `https://ec.maxlien.shop/n/`.
- Funil protegido: `/n/` Nitrix EC mobile, desktop fora da VSL.
- Telefone oficial da operacao: `553183002800`.
- Pixel/Dataset EC: `1468946114265008`.
- Produto de entrada: `nitrix_ec` / `Nitrix Oxide Ecuador`.
- Meta Lead: PageView/Lead deduplicados na VSL, com CAPI EC.
- Meta Purchase: disparo somente pelo backend/painel quando pedido fica `confirmed`, com valor positivo, moeda `USD`, produto EC e lock `purchase_capi_lock`.

## Trava tecnica criada

Arquivo: `FREEZE_LOCK_EC.json`

Novas regras ativas:

- `vsl_nitrix_mobile_entry_ec`
- `meta_pixel_lead_ec_dataset`
- `meta_purchase_confirmed_order_lock_ec`

Registro automatico do congelamento:

- `approved_freezes/APPROVED_FREEZE_EC_20260709111942.md`

Guardas executados no congelamento:

- `node scripts/guard-freeze-lock-ec.mjs`
- `node scripts/guard-status-panels-freeze.mjs`
- `node scripts/audit-customer-draft-zero-quantity.mjs`
- `node scripts/audit-no-regression-meta-country.mjs`
- `node scripts/audit-ec-nitrix-guard.mjs`
- `node scripts/audit-ec-product-micro-layer.mjs`
- `node scripts/guard-public-funnel.mjs`

Resultado: OK, 9 regras congeladas preservadas.

## Problema observado no painel

Print do operador mostrou o topo do painel com:

- `waBadge` em `ERRO`;
- texto `Unexpected token '<', "<!DOCTYPE "... is not valid JSON`;
- `opsAlertBtn` vermelho com `ALERTA 2`.

Causa da parte `ERRO`:

- o painel chamava `/api/zapi/status` com `res.json()` direto;
- se qualquer camada intermediaria devolvesse HTML temporario em vez de JSON, o erro bruto do parser aparecia no topo e derrubava o status para vermelho;
- no momento da auditoria, `/api/zapi/status`, `/api/zapi/device` e `/api/whatsapp/status` responderam JSON 200, entao o problema era fragilidade do frontend contra resposta HTML/transiente, nao desconexao confirmada da Z-API.

Observacao adicional:

- algumas rotas sem barra final, como `/api/orders` e `/api/shipments`, retornam `301 text/html` antes de seguir para JSON com barra final. Isso reforca a necessidade de leituras JSON defensivas no painel.

## Correcao aplicada

Arquivo: `public/qr.html`

- criado `fetchPanelJson()` para ler texto, validar JSON e gerar diagnostico controlado quando vier HTML;
- `checkStatus()` passou a usar `fetchPanelJson('/api/zapi/status')`;
- `loadConnections()` passou a usar `fetchPanelJson()` nos fallbacks de `/api/whatsapp/status` e `/api/zapi/device`;
- criado cache do ultimo status Z-API conectado por 120 segundos;
- se houver erro transiente depois de status conectado recente, o painel mantem `Z-API` verde e mostra a ultima leitura valida, sem piscar falso vermelho;
- se nao houver leitura valida recente, o painel ainda mostra erro real, mas com mensagem controlada.

## Diagnostico do `ALERTA 2`

O botao `ALERTA 2` nao era o erro JSON. Ele veio do status operacional:

- `manualSendRequired: 6`;
- `reengagementCandidates: 14`;
- Meta EC configurado: `ecConfigured: true`;
- Pixel EC ativo: `1468946114265008`;
- `testMode: false`.

Pedidos em revisao manual identificados na auditoria:

- `EC-MRBD0COI-ELOR`, final `9733`, Darwin Lucio Yumbo AlvaradConfirm, motivo: pausa anti-spam/PM2 antigo.
- `EC-DROPI-6031413`, final `2015`, Angel Isaac Almeida Vallejos, motivo: pausa urgente por guia repetida.
- `EC-MQQ5F10I-FAUM`, final `0720`, Jhon Paul, motivo: pedido anterior nao retirado.
- `EC-MQOKJKVS-VN1N`, final `1066`, Luis saltos, motivo: pedido anterior nao retirado.
- `EC-MQK8ELKZ-ZXZS`, final `2572`, Isidro isidoro solis yepez, motivo: pedido anterior nao retirado.
- `EC-MQMIZ2U7-LTYL`, final `4779`, Diego David Mashianda, motivo: pedido anterior nao retirado.

Regra operacional: estes pedidos nao devem ser liberados automaticamente so para apagar o alerta. A revisao manual evita repetir guia/mensagem ou reenviar pedido para cliente com historico de nao retirada.

## Validacoes locais

- `qr.html inline JS parse OK`
- `node scripts/guard-freeze-lock-ec.mjs`
- `node scripts/audit-no-regression-meta-country.mjs`
- `node scripts/audit-ec-nitrix-guard.mjs`

## Regra final

VSL, Meta Lead e Meta Purchase EC estao congelados. Ajustes futuros no painel podem ser feitos, mas nao podem quebrar as regras ativas de `FREEZE_LOCK_EC.json` nem liberar automaticamente pedido em revisao manual sem decisao operacional.

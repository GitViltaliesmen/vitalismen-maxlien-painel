# V148 — Hostinger candidata, sem publicacao

Baseline exclusiva: commit `f7927a9a8720d64f3c8ba5f02dcd290f2774f08f`, tree `0bfa0d9e298045764dad86ec3096186d6880daba`, release `/opt/vitalismen-automacao/releases/20260910T222419Z_production-20260910-f7927a9`, freeze `freeze-production-v147-r6r2-all-postsale-operational-20260910`. Fonte oficial auditada por SSH em `72.60.137.77`. Nenhuma alteracao de producao.

## Causas e responsabilidades
| Funcao | Dono | Estado anterior / causa | Mudanca necessaria |
| --- | --- | --- | --- |
| Identidade/captura SALES | Contabo | Bridge existente inativa | Candidata independente Contabo |
| Continuidade | Contrato | Visitante persistente reutilizado entre formularios | sessionId recebe event_id do Lead existente |
| Persistencia | Hostinger | Contexto sem identidade renderizada e sem ciclo | Mesmo VslVisit/ContactState/Order.tracking, validacao V148 |
| InitiateCheckout | Hostinger | V146 em outro funil; chamada Meta bloqueada pelo perfil V78 | Gatilho Tex Ultra apos quantidade explicita persistida, escopo estreito |
| Dedupe | Hostinger | V146 com lock expiravel e sucesso sem aceite confirmado | Ledger do evento de negocio com _id unico, sem reenvio cego |
| Purchase | Hostinger | Destino historico Protocolo G diferente do Pixel publico atual | Contextos V148 escolhem EC_DEFAULT existente 1468946114265008 |
| Aceitacao | Hostinger | HTTP 200 insuficiente | Exigir 2xx e events_received positivo |

## Gatilho e limites
InitiateCheckout ocorre depois que o cliente escolhe explicitamente 1, 2, 3 ou 6 frascos e essa quantidade e persistida pelo funil Tex Ultra. PageView, video, refresh, formulario/Lead e clique generico de WhatsApp nao criam InitiateCheckout. A medicao e somente server-side; nao existe duplicata browser desse checkout.

O campo `action_source=chat` representa a escolha no atendimento por mensagens. Fonte primaria: [enum oficial Meta SDK](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/action_source.py). O [contrato oficial de evento](https://github.com/facebook/facebook-python-business-sdk/blob/main/facebook_business/adobjects/serverside/event.py) define event_time e dedupe por event_name/event_id. Nao foi criada integracao CTWA/Cloud API, WABA nem transferida credencial. A origem da VSL continua no tracking canonico, sem inventar URL do evento de chat.

A ativacao precisa de receipt oficial com commit igual ao release-source e health validado. Message.timestamp do provedor e a persistencia devem ser posteriores a ativacao. Nao ha job, replay, backfill ou consulta historica para enviar eventos.

MetaBusinessEvent registra identidade, reserva, fingerprint do contexto canonico e resposta, sem segundo modelo de atribuicao. O escopo Mongo permite somente insert/update desse evento na entrada Z-API valida; vinculo ao Order somente durante submit Dropi humano autenticado. Orders, deletes e escritas fora do escopo continuam bloqueados.

A mesma reserva sobrevive a restart, worker concorrente e resposta ambigua. Resposta sem aceite nao marca sentAt. A ambiguidade fica persistida, sem retry cego. Recompra usa currentNegotiationOrderId/orderId atual; previousOrderId nao identifica o novo checkout. Um contexto de pedido anterior e descartado na recompra organica. O vinculo de Purchase rejeita outro cliente, outro contexto ou outro Order.

## Manifesto por arquivo
Todos os overrides estao em `docs/freeze/ec-meta-funnel-v148-20260910.json`.
- `src/services/texUltraFunnelService.js`: hook de medicao depois da escolha persistida; origem de tracking V148 canonica.
- `src/services/metaCheckoutV148Service.js`: evidencia forward, ciclo, reserva idempotente e aceite.
- `src/models/MetaBusinessEvent.js`: ledger persistente unico de evento, sem copia de atribuicao.
- `src/services/metaFunnelV148ContractService.js`: contrato de ativacao, identidade, fingerprint e escopos estreitos.
- `src/services/ecBotCoreRuntimeIntegrationV78Service.js`: permite apenas operacoes do novo ledger no escopo comprovado; allowlist geral preservada.
- `src/services/metaPurchaseV148BindingService.js`: vincula fingerprint do checkout a exatamente um pedido/cliente.
- `src/services/metaConversionsService.js`: excecao restrita de IC, destino existente e aceite; gate V144 de Purchase preservado.
- `src/services/metaProtocoloGAttributionService.js`: validacao/propagacao dos campos V148.
- `src/services/metaAttributionService.js`: preserva contexto V148 canonico, inclusive organico, sem busca por telefone de outro pedido.
- `src/services/metaAttributionBridgeService.js`: correlacao organica somente com identidade SALES valida e mensagem unica.
- `src/routes/whatsapp.js`: separa visitas por Lead existente e conserva o dono da correlacao em reenvio.
- `src/models/Order.js`: persiste os campos do contrato e a referencia do checkout no tracking ja existente.
- Preload/guard V146/R6R2 e package.json: registram sucessao auditavel e teste V148, sem desativar guards anteriores.
- `scripts/test-meta-funnel-v148-mongo-sink.mjs`: dois processos, Mongo e guard V78 reais em banco isolado de staging; POST externo proibido por sink.

## Contrato e compatibilidade
Fixture de dados `tests/fixtures/meta-funnel-v148-contract.json`, SHA256 `d7a72618bc8c3c233e1c18aa5997b78b53cf0f3660e3d1e4cf93866ba26c1e6a`. Os sete campos campaign_id/adset_id/ad_id/fbclid/placement/fbc/fbp atravessam o contrato existente. Codigo e configuracao do Contabo nao integram o payload da Hostinger.

Ordem proposta apos aprovacao e gates: Hostinger primeiro, Contabo depois. Hostinger mantem compatibilidade com payload legado; o novo contrato exige a candidata Hostinger para a semantica de ciclo/destino. Nao publicar o Contabo sobre a baseline antiga.

## Producao observada
Em 2026-09-11T01:30:43Z: PM2 online, current baseline preservado, Mongo ping OK, Nginx ativo, health local/publico online, Z-API conectada e webhooks oficiais corretos. Meta Ads cache disponivel, atualizado em 01:28:46Z, sem erro. Dataset EC_DEFAULT 1468946114265008 e token presente; nenhum token exibido ou modificado. 202 pedidos com metaPurchaseSentAt e 202 com events_received positivo. V114 e V116 ultimo exit 0; ProtectHome V116=yes.

Nao ha codigo Test Events configurado. Nenhum envio artificial real foi feito. Aceite V148 e validado em sink; a prova natural continua aguardando futura aprovacao/publicacao e evento real.

## Preservado e bloqueio independente
P5/P6/P7, A07/A10/A19, ledger pos-venda unificado, polling Servientrega, V114/V116, Chromium/ProtectHome, Dropi manual, takeover humano, CAPI Purchase V144 e flags operacionais de producao preservados. Nenhum token, dataset, pixel, conta ou permissao foi alterado.

Contabo possui bloqueio preexistente no gate de dependencias: 3 MODERATE e 7 HIGH na auditoria atual, apesar de package/lock nao alterados. Nao foi relaxado o guard nem executado upgrade fora do escopo de tracking. A publicacao dual-VPS permanece bloqueada enquanto esse gate falhar.

## Validacao e rollback
Resultados finais e identidades serao registrados no receipt externo de staging/candidata, sem modificar o artifact apos congelar. Tentativas locais com .env de observacao ativaram corretamente STRICT_READ_ONLY e reprovaram sinks; o runner final usa autorizacao operacional somente no processo de teste, sem credenciais e sem publicar flags.

Rollback futuro da Hostinger deve usar exclusivamente o mecanismo oficial e a baseline f7927a9, apos preflight de compatibilidade. Nenhum rollback, publish, activate ou envio ao cliente foi executado pela V148.

PRODUCTION_CHANGED=NO
REAL_META_PRODUCTION_EVENTS_SENT=0
PUBLICATION_ALLOWED=NO
